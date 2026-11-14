import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authorizeReceipt, secureCompletion } from "../receipt-access"
import { issueReceiptToken, checkoutKey } from "../../../../utils/receipt-tokens"

const secret = "a".repeat(64)
function fixture(customerId?: string) {
  const req = {
    params: { id: "order_test" },
    headers: {},
    auth_context: customerId ? { actor_id: customerId } : undefined,
    scope: {
      resolve: () => ({
        graph: jest
          .fn()
          .mockResolvedValue({ data: [{ id: "order_test", customer_id: "cus_owner" }] }),
      }),
    },
  }
  const setHeader = jest.fn()
  const res = { setHeader, json: sender }
  const next = jest.fn()
  return {
    req: req as unknown as AuthenticatedMedusaRequest,
    res: res as unknown as MedusaResponse,
    next,
    setHeader,
  }
}
beforeEach(() => {
  sender.mockClear()
  process.env.RECEIPT_ACCESS_SECRET = secret
})
afterEach(() => {
  delete process.env.RECEIPT_ACCESS_SECRET
})

it.each([undefined, "cus_other"])(
  "denies direct retrieval by %s, including forged legacy cookies",
  async (customer) => {
    const { req, res, next } = fixture(customer)
    req.headers.cookie = "_medusa_order_access=order_test"
    await authorizeReceipt(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ type: "not_found" }))
  },
)
it("allows the verified owner", async () => {
  const { req, res, next, setHeader } = fixture("cus_owner")
  await authorizeReceipt(req, res, next)
  expect(next).toHaveBeenCalledWith()
  expect(setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store")
})
it("allows a valid receipt token", async () => {
  const { req, res, next } = fixture()
  req.headers["x-receipt-token"] = issueReceiptToken("order_test")
  await authorizeReceipt(req, res, next)
  expect(next).toHaveBeenCalledWith()
})
it.each(["other-order", "tampered", "expired"])("rejects %s tokens", async (kind) => {
  const { req, res, next } = fixture()
  const token = issueReceiptToken(
    kind === "other-order" ? "order_other" : "order_test",
    kind === "expired" ? Date.now() - 31 * 86400000 : Date.now(),
  )
  req.headers["x-receipt-token"] = kind === "tampered" ? token + "x" : token
  await authorizeReceipt(req, res, next)
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ type: "not_found" }))
})
it("blocks public cart completion, even with a known cart ID", () => {
  const { req, res, next } = fixture()
  secureCompletion(req, res, next)
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ type: "unauthorized" }))
})
it("issues a credential only on successful trusted completion", () => {
  const { req, res, next } = fixture()
  req.headers["x-storefront-checkout-key"] = checkoutKey()
  secureCompletion(req, res, next)
  expect(next).toHaveBeenCalledWith()
  res.json({ type: "order", order: { id: "order_test" } })
  expect(res.json).toBeDefined()
  // The original JSON sender receives the receipt credential.
  const sent = sender.mock.calls.at(-1)?.[0] as { type: string; receipt_token: unknown }
  expect(sent.type).toBe("order")
  expect(typeof sent.receipt_token).toBe("string")
})
const sender = jest.fn((body: unknown) => body)

it("does not issue a token for failed or pending completion", () => {
  const { req, res, next } = fixture()
  req.headers["x-storefront-checkout-key"] = checkoutKey()
  secureCompletion(req, res, next)
  res.json({ type: "cart", cart: { id: "cart_pending" } })
  expect(sender).toHaveBeenCalledWith({ type: "cart", cart: { id: "cart_pending" } })
})

it("fails closed when the signing secret is missing", async () => {
  const { req, res, next } = fixture()
  req.headers["x-receipt-token"] = issueReceiptToken("order_test")
  delete process.env.RECEIPT_ACCESS_SECRET
  await authorizeReceipt(req, res, next)
  expect(next).toHaveBeenCalledWith(expect.any(Error))
})
