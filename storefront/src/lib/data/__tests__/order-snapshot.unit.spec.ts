import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), products: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ updateTag: vi.fn() }))
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: mocks.fetch } } }))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: async () => ({}),
  getReceiptHeaders: async () => ({}),
}))
vi.mock("@lib/data/products", () => ({ getProductsById: mocks.products }))
import { retrieveOrder } from "../orders"

beforeEach(() => {
  vi.clearAllMocks()
})
it("returns the persisted receipt without catalog access even during a catalog outage", async () => {
  const order = {
    id: "order_1",
    region_id: "reg_1",
    items: [
      {
        id: "item_1",
        product_id: "prod_deleted",
        title: "Purchased item",
        thumbnail: "/snapshot.jpg",
        variant_title: "Original variant",
      },
    ],
  }
  mocks.fetch.mockResolvedValue({ order })
  mocks.products.mockRejectedValue(new Error("Catalog unavailable"))
  expect(await retrieveOrder("order_1")).toEqual(order)
  expect(mocks.products).not.toHaveBeenCalled()
})
it("explicitly excludes live catalog relations from the order API query", async () => {
  mocks.fetch.mockResolvedValue({ order: { id: "order_1", items: [] } })
  await retrieveOrder("order_1")
  const options = mocks.fetch.mock.calls[0]?.[1] as { query: { fields: string } }
  const fields = options.query.fields.split(",")
  expect(fields).toContain("-items.variant")
  expect(fields).toContain("-items.product")
})
it("preserves real order retrieval failures", async () => {
  mocks.fetch.mockRejectedValue(new Error("Order access denied"))
  await expect(retrieveOrder("order_1")).rejects.toThrow()
  expect(mocks.products).not.toHaveBeenCalled()
})
