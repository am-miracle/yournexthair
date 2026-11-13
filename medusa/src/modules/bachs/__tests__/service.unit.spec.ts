import { BachsPaymentService, type BachsSessionData } from "../service"
import { computeSignature } from "../webhook"

const options = {
  api_key: "sk_sandbox_123",
  webhook_secret: "whsec_test",
  storefront_url: "https://shop.example.com/",
}

const sessionData: BachsSessionData = {
  session_id: "payses_1",
  checkout_id: "chk_1",
  checkout_url: "https://checkout.bachs.io/chk_1",
  expires_at: null,
  reference: "payses_1_NGN_50000.00",
  amount: "50000.00",
  currency: "NGN",
  email: "jane@example.com",
  customer_name: "Jane Doe",
  country_code: "ng",
}

const completedCheckout = {
  checkout_id: "chk_1",
  status: "COMPLETED",
  payment_status: "succeeded",
  amount: "50000.00",
  currency: "NGN",
  metadata: { session_id: "payses_1" },
  charge: { payment_id: "pay_1", amount_paid: "50000.00" },
}

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as Response

describe("BachsPaymentService", () => {
  const fetchMock = jest.spyOn(global, "fetch")
  const service = new BachsPaymentService({}, options)

  afterEach(() => fetchMock.mockReset())

  it("creates a hosted checkout in main currency units", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ checkout_id: "chk_1", checkout_url: "https://checkout.bachs.io/chk_1" }),
    )

    const result = await service.initiatePayment({
      amount: 50000,
      currency_code: "ngn",
      data: { session_id: "payses_1", email: "jane@example.com", customer_name: "Jane Doe", country_code: "NG" },
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://sandbox-api.bachs.io/v1/checkout-sessions")
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer sk_sandbox_123",
      "Idempotency-Key": "payses_1_NGN_50000.00",
    })
    expect(JSON.parse(init?.body as string)).toMatchObject({
      pricing: { currency: "NGN", amount: "50000.00" },
      metadata: { session_id: "payses_1" },
      success_url: "https://shop.example.com/ng/checkout/bachs/return",
      cancel_url: "https://shop.example.com/ng/checkout?step=payment",
    })
    expect(result).toMatchObject({ id: "chk_1", data: { checkout_url: "https://checkout.bachs.io/chk_1" } })
  })

  it("rejects an invalid country code before calling Bachs", async () => {
    await expect(
      service.initiatePayment({
        amount: 10,
        currency_code: "usd",
        data: { session_id: "payses_1", email: "jane@example.com", country_code: "../evil" },
      }),
    ).rejects.toThrow("country code")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps the checkout when the amount is unchanged", async () => {
    await expect(
      service.updatePayment({ amount: 50000, currency_code: "ngn", data: sessionData }),
    ).resolves.toEqual({ data: sessionData })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("captures a completed checkout that matches the session", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(completedCheckout))

    await expect(service.authorizePayment({ data: sessionData })).resolves.toMatchObject({
      status: "captured",
      data: { payment_id: "pay_1" },
    })
  })

  it("captures a completed checkout reported with lowercase status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...completedCheckout, status: "completed", payment_status: "SUCCEEDED" }))

    await expect(service.authorizePayment({ data: sessionData })).resolves.toMatchObject({ status: "captured" })
  })

  it("errors when the paid amount does not match the session", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...completedCheckout, amount: "500.00" }))

    await expect(service.authorizePayment({ data: sessionData })).resolves.toMatchObject({
      status: "error",
    })
  })

  it("stays pending while the checkout is open", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...completedCheckout, status: "OPEN", payment_status: "processing" }),
    )

    await expect(service.authorizePayment({ data: sessionData })).resolves.toMatchObject({
      status: "pending",
    })
  })

  it("reports underpaid checkouts as requiring more without authorizing them", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...completedCheckout, status: "OPEN", payment_status: "underpaid",
      charge: { payment_id: "pay_1", status: "underpaid", amount_paid: "100.00" },
    }))
    await expect(service.authorizePayment({ data: sessionData })).resolves.toMatchObject({ status: "requires_more" })
  })

  it("refuses a second refund on the same charge", async () => {
    await expect(
      service.refundPayment({ amount: 100, data: { ...sessionData, payment_id: "pay_1", refund_id: "ref_1" } }),
    ).rejects.toThrow("one refund per charge")
  })

  it("sends partial refunds with an amount and full refunds without", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ refund_id: "ref_1", status: "processing" }))

    await service.refundPayment({ amount: 1000, data: { ...sessionData, payment_id: "pay_1" } })
    await service.refundPayment({ amount: 50000, data: { ...sessionData, payment_id: "pay_1" } })

    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>)
    expect(bodies[0]).toEqual({ charge_id: "pay_1", reference: "refund_pay_1", amount: "1000.00" })
    expect(bodies[1]).toEqual({ charge_id: "pay_1", reference: "refund_pay_1" })
  })

  describe("getWebhookActionAndData", () => {
    const signed = (event: unknown) => {
      const raw = Buffer.from(JSON.stringify(event))
      const ts = String(Math.floor(Date.now() / 1000))
      return {
        data: event as Record<string, unknown>,
        rawData: raw,
        headers: { "x-bachs-signature-v2": `t=${ts},v1=${computeSignature(ts, raw, options.webhook_secret)}` },
      }
    }

    it("authorizes the session after re-fetching the checkout", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(completedCheckout))

      await expect(
        service.getWebhookActionAndData(
          signed({ id: "evt_1", type: "collection.succeeded", data: { checkout_id: "chk_1" } }),
        ),
      ).resolves.toEqual({ action: "authorized", data: { session_id: "payses_1", amount: "50000.00" } })
      expect(fetchMock.mock.calls[0]![0]).toBe("https://sandbox-api.bachs.io/v1/checkout-sessions/chk_1")
    })

    it("ignores deliveries with a bad signature", async () => {
      const payload = signed({ id: "evt_1", type: "collection.succeeded", data: { checkout_id: "chk_1" } })

      await expect(
        service.getWebhookActionAndData({ ...payload, rawData: Buffer.from("{}") }),
      ).resolves.toEqual({ action: "not_supported" })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("uses the signed body instead of an unverified parsed payload", async () => {
      const payload = signed({ type: "customer.created", data: {} })
      await expect(service.getWebhookActionAndData({
        ...payload, data: { type: "collection.succeeded", data: { checkout_id: "chk_1" } },
      })).resolves.toEqual({ action: "not_supported" })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("ignores events it does not act on", async () => {
      await expect(
        service.getWebhookActionAndData(signed({ id: "evt_2", type: "checkout.expired", data: {} })),
      ).resolves.toEqual({ action: "not_supported" })
    })
  })
})
