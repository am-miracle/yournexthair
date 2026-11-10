import type { IPaymentModuleService, PaymentSessionDTO, UpdatePaymentSessionDTO } from "@medusajs/framework/types"
import { BachsClient } from "../client"
import { reconcileBachsWebhook } from "../reconcile"
import { computeSignature } from "../webhook"

const secret = "whsec_test"
const signed = (type: string, data: Record<string, unknown>) => {
  const rawData = Buffer.from(JSON.stringify({ id: "evt_1", type, data }))
  const ts = String(Math.floor(Date.now() / 1000))
  return { data: {}, rawData, headers: { "x-bachs-signature-v2": `t=${ts},v1=${computeSignature(ts, rawData, secret)}` } }
}
const checkout = {
  checkout_id: "chk_1", status: "OPEN", payment_status: "failed", amount: "100.00", currency: "NGN",
  metadata: { session_id: "payses_1" }, charge: { payment_id: "pay_1" },
}
function setup() {
  let session = {
    id: "payses_1", provider_id: "pp_bachs_bachs", status: "pending", amount: 100, currency_code: "ngn",
    data: { checkout_id: "chk_1", amount: "100.00", currency: "NGN" }, metadata: { keep: "existing" },
  } as unknown as PaymentSessionDTO
  const retrievePaymentSession = jest.fn().mockImplementation(() => Promise.resolve(session))
  const updatePaymentSession = jest.fn().mockImplementation((update: UpdatePaymentSessionDTO) => {
    session = { ...session,
      ...(update.status ? { status: update.status } : {}),
      ...(update.metadata ? { metadata: update.metadata } : {}),
    }
    return Promise.resolve(session)
  })
  const client = new BachsClient("sk_sandbox_test", "https://sandbox-api.bachs.io")
  const getCheckoutSession = jest.spyOn(client, "getCheckoutSession").mockResolvedValue({ ...checkout })
  const getPayment = jest.spyOn(client, "getPayment").mockResolvedValue({ checkout_id: "chk_1" })
  const getRefund = jest.spyOn(client, "getRefund").mockResolvedValue({
    refund_id: "ref_1", charge_id: "pay_1", status: "success", requested_amount: "50.00", refunded_amount: "50.00",
  })
  const logger = { warn: jest.fn(), error: jest.fn() }
  const run = (payload = signed("collection.failed", { checkout_id: "chk_1" })) => reconcileBachsWebhook({
    payload, secret, client, logger,
    payments: { retrievePaymentSession, updatePaymentSession } as unknown as IPaymentModuleService,
    withLock: async (_key, job) => job(),
  })
  return { run, getCheckoutSession, getPayment, getRefund, updatePaymentSession, logger,
    setSession: (changes: Partial<PaymentSessionDTO>) => { session = { ...session, ...changes } } }
}

describe("Bachs outcome reconciliation", () => {
  it.each([
    ["collection.failed", "OPEN", "failed", "error", "failed"],
    ["collection.underpaid", "OPEN", "underpaid", "requires_more", "underpaid"],
    ["checkout.expired", "EXPIRED", "pending", "canceled", "expired"],
  ])("persists %s and preserves metadata", async (event, state, paymentState, expected, label) => {
    const test = setup()
    test.getCheckoutSession.mockResolvedValue({ ...checkout, status: state, payment_status: paymentState })
    await test.run(signed(event, { checkout_id: "chk_1" }))
    expect(test.updatePaymentSession).toHaveBeenCalledWith(expect.objectContaining({
      status: expected, metadata: { keep: "existing", bachs_payment_status: label },
    }))
  })
  it("recognizes an underpaid charge while checkout remains pending", async () => {
    const test = setup()
    test.getCheckoutSession.mockResolvedValue({ ...checkout, payment_status: "pending", charge: { status: "underpaid" } })
    await test.run(signed("collection.underpaid", { checkout_id: "chk_1" }))
    expect(test.updatePaymentSession).toHaveBeenCalledWith(expect.objectContaining({ status: "requires_more" }))
  })
  it.each(["authorized", "captured"])("never downgrades a %s session", async (status) => {
    const test = setup()
    test.setSession({ status: status as PaymentSessionDTO["status"] })
    await test.run()
    expect(test.updatePaymentSession).not.toHaveBeenCalled()
  })
  it("ignores stale failures after success or a newer pending retry", async () => {
    const test = setup()
    for (const payment_status of ["succeeded", "pending"]) {
      test.getCheckoutSession.mockResolvedValue({ ...checkout, payment_status })
      await test.run()
    }
    expect(test.updatePaymentSession).not.toHaveBeenCalled()
  })
  it("makes repeated deliveries idempotent", async () => {
    const test = setup()
    await test.run()
    await test.run()
    expect(test.updatePaymentSession).toHaveBeenCalledTimes(1)
  })
  it.each([{ currency: "USD" }, { amount: "101.00" }, { checkout_id: "chk_other" }])("rejects mismatches: %j", async (changes) => {
    const test = setup()
    test.getCheckoutSession.mockResolvedValue({ ...checkout, ...changes })
    await expect(test.run()).rejects.toThrow("does not match")
    expect(test.updatePaymentSession).not.toHaveBeenCalled()
  })
  it("rejects a different provider", async () => {
    const test = setup()
    test.setSession({ provider_id: "pp_other" })
    await expect(test.run()).rejects.toThrow("does not match")
  })
  it("rejects invalid signatures without API calls", async () => {
    const test = setup()
    await test.run({ ...signed("collection.failed", {}), rawData: Buffer.from("{}") })
    expect(test.getCheckoutSession).not.toHaveBeenCalled()
    expect(test.getRefund).not.toHaveBeenCalled()
  })
  it("resolves charge events through the payment API", async () => {
    const test = setup()
    await test.run(signed("collection.failed", { charge_id: "pay_1" }))
    expect(test.getPayment).toHaveBeenCalledWith("pay_1")
    expect(test.updatePaymentSession).toHaveBeenCalledTimes(1)
  })
  it.each(["processing", "success", "failed"])("records refund %s without changing paid state", async (status) => {
    const test = setup()
    test.setSession({ status: "captured" })
    test.getRefund.mockResolvedValue({ refund_id: "ref_1", charge_id: "pay_1", status })
    await test.run(signed("refund.paid", { refund_id: "ref_1" }))
    const update = test.updatePaymentSession.mock.calls[0]![0] as UpdatePaymentSessionDTO
    expect(update.status).toBe("captured")
    expect(update.metadata?.bachs_refunds).toMatchObject({ ref_1: { refund_id: "ref_1", status } })
    expect(test.logger.error).toHaveBeenCalledTimes(status === "failed" ? 1 : 0)
  })
  it("deduplicates refund outcomes and does not downgrade success", async () => {
    const test = setup()
    const payload = signed("refund.paid", { refund_id: "ref_1" })
    await test.run(payload)
    await test.run(payload)
    test.getRefund.mockResolvedValue({ refund_id: "ref_1", charge_id: "pay_1", status: "processing" })
    await test.run(signed("refund.created", { refund_id: "ref_1" }))
    expect(test.updatePaymentSession).toHaveBeenCalledTimes(1)
  })
  it("rejects refunds for a different charge", async () => {
    const test = setup()
    test.getRefund.mockResolvedValue({ refund_id: "ref_1", charge_id: "pay_other", status: "success" })
    await expect(test.run(signed("refund.paid", { refund_id: "ref_1" }))).rejects.toThrow("charge mismatch")
    expect(test.updatePaymentSession).not.toHaveBeenCalled()
  })
  it("keeps separate refund attempts when an older event is delivered later", async () => {
    const test = setup()
    await test.run(signed("refund.paid", { refund_id: "ref_1" }))
    test.getRefund.mockResolvedValue({ refund_id: "ref_2", charge_id: "pay_1", status: "failed" })
    await test.run(signed("refund.failed", { refund_id: "ref_2" }))
    const update = test.updatePaymentSession.mock.calls[1]![0] as UpdatePaymentSessionDTO
    expect(update.metadata?.bachs_refunds).toMatchObject({
      ref_1: { status: "success" }, ref_2: { status: "failed" },
    })
  })
  it("propagates API failures for event-bus retries", async () => {
    const test = setup()
    test.getRefund.mockRejectedValue(new Error("API unavailable"))
    await expect(test.run(signed("refund.failed", { refund_id: "ref_1" }))).rejects.toThrow("API unavailable")
    expect(test.updatePaymentSession).not.toHaveBeenCalled()
  })
})
