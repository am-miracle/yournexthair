import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ listOrders: vi.fn(), getCustomer: vi.fn() }))
vi.mock("@lib/data/orders", () => ({ listOrders: mocks.listOrders }))
vi.mock("@lib/data/customer", () => ({ getCustomer: mocks.getCustomer }))
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock("next/image", () => ({ default: () => null }))
vi.mock("@/components/Button", () => ({ ButtonLink: () => null }))
vi.mock("@/components/ui/Tag", () => ({ UiTag: () => null }))
vi.mock("@/components/LocalizedLink", () => ({
  LocalizedLink: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}))
vi.mock("@modules/store/components/pagination", () => ({
  Pagination: ({ page, totalPages }: { page: number; totalPages: number }) =>
    React.createElement("nav", null, `Page ${page} of ${totalPages}`),
}))
import OrdersPage from "../../../app/[countryCode]/(main)/account/my-orders/page"

const load = (page?: string | string[]) =>
  OrdersPage({
    params: Promise.resolve({ countryCode: "ng" }),
    searchParams: Promise.resolve(page === undefined ? {} : { page }),
  })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCustomer.mockResolvedValue({ id: "cus_1" })
  mocks.listOrders.mockResolvedValue({ orders: [], count: 0 })
})
it.each(
  [
    "abc",
    "0",
    "-1",
    "1.5",
    "2abc",
    "1e2",
    "",
    " 2",
    "9007199254740992",
    "9007199254740991",
    ["1", "2"],
  ].map((page) => [page]),
)("redirects invalid page %j before fetching", async (page) => {
  await expect(load(page)).rejects.toThrow("redirect:/ng/account/my-orders?page=1")
  expect(mocks.listOrders).not.toHaveBeenCalled()
})
it("defaults to page one", async () => {
  await load()
  expect(mocks.listOrders).toHaveBeenCalledWith(6, 0)
})
it("uses the correct offset for a valid page", async () => {
  mocks.listOrders.mockResolvedValue({ orders: [], count: 12 })
  await load("2")
  expect(mocks.listOrders).toHaveBeenCalledWith(6, 6)
})
it("redirects a page beyond the end to the last page", async () => {
  mocks.listOrders.mockResolvedValue({ orders: [], count: 7 })
  await expect(load("99")).rejects.toThrow("redirect:/ng/account/my-orders?page=2")
})
it("recovers to page one for an empty history", async () => {
  await expect(load("2")).rejects.toThrow("redirect:/ng/account/my-orders?page=1")
})
it("shows the empty-history message only for zero total orders", async () => {
  expect(renderToStaticMarkup(await load())).toContain("ordered anything yet")
})
it("keeps navigation and recovery when a nonempty history returns an empty page", async () => {
  mocks.listOrders.mockResolvedValue({ orders: [], count: 12 })
  const html = renderToStaticMarkup(await load("2"))
  expect(html).not.toContain("ordered anything yet")
  expect(html).toContain("Page 2 of 2")
  expect(html).toContain('href="/account/my-orders?page=1"')
})
it("still redirects unauthenticated visitors before fetching orders", async () => {
  mocks.getCustomer.mockResolvedValue(null)
  await expect(load("abc")).rejects.toThrow("redirect:/ng/auth/login")
  expect(mocks.listOrders).not.toHaveBeenCalled()
})

it("renders the last valid page with its orders and navigation", async () => {
  mocks.listOrders.mockResolvedValue({
    orders: [
      {
        id: "order_last",
        display_id: 7,
        created_at: "2026-11-13T12:00:00Z",
        items: [],
      },
    ],
    count: 7,
  })
  const html = renderToStaticMarkup(await load("2"))
  expect(html).toContain("Order #7")
  expect(html).toContain("Page 2 of 2")
  expect(html).not.toContain("ordered anything yet")
})
