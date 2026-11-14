import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  accept: vi.fn(),
  headers: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }))
vi.mock("@lib/config", () => ({
  sdk: { client: { fetch: mocks.fetch }, store: { order: { acceptTransfer: mocks.accept } } },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: mocks.headers,
  getReceiptHeaders: async () => ({}),
}))
import { acceptOrderTransfer } from "../orders"
beforeEach(() => {
  vi.clearAllMocks()
  mocks.headers.mockResolvedValue({ authorization: "Bearer verified" })
  mocks.fetch.mockResolvedValue({ customer: { id: "cus_1" } })
  mocks.accept.mockResolvedValue({})
})
it("does not submit claims while signed out", async () => {
  mocks.headers.mockResolvedValue({})
  expect(await acceptOrderTransfer("order_1", "token-1")).toEqual({
    ok: false,
    reason: "authentication_required",
  })
  expect(mocks.accept).not.toHaveBeenCalled()
})
it("verifies expired credentials before submitting", async () => {
  mocks.fetch.mockRejectedValue({ status: 401 })
  expect(await acceptOrderTransfer("order_1", "token-1")).toEqual({
    ok: false,
    reason: "authentication_required",
  })
  expect(mocks.accept).not.toHaveBeenCalled()
})
it("treats session lookup outages as recoverable", async () => {
  mocks.fetch.mockRejectedValue(new Error("Network unavailable"))
  expect(await acceptOrderTransfer("order_1", "token-1")).toEqual({
    ok: false,
    reason: "retryable",
  })
  expect(mocks.accept).not.toHaveBeenCalled()
})
it("submits authenticated claims and refreshes order history", async () => {
  expect(await acceptOrderTransfer("order_1", "token-1")).toEqual({ ok: true })
  expect(mocks.accept).toHaveBeenCalledWith(
    "order_1",
    { token: "token-1" },
    {},
    { authorization: "Bearer verified" },
  )
  expect(mocks.updateTag).toHaveBeenCalledWith("orders")
})
it.each([
  [401, "authentication_required"],
  [400, "invalid_claim"],
  [404, "invalid_claim"],
  [500, "retryable"],
])("classifies HTTP %s", async (status, reason) => {
  mocks.accept.mockRejectedValue({ status })
  expect(await acceptOrderTransfer("order_1", "token-1")).toEqual({ ok: false, reason })
})
it("rejects malformed claims without submitting", async () => {
  expect(await acceptOrderTransfer("invalid", "token-1")).toEqual({
    ok: false,
    reason: "invalid_claim",
  })
  expect(mocks.accept).not.toHaveBeenCalled()
})
