import { FetchError } from "@medusajs/js-sdk"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const browser = vi.hoisted(() => ({ cart: undefined as string | undefined }))
const medusa = vi.hoisted(() => ({
  fetch: vi.fn(),
  create: vi.fn(),
  createLineItem: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: { maxAge?: number }) => {
      if (name === "_medusa_cart_id") browser.cart = options.maxAge === -1 ? undefined : value
    },
    get: (name: string) =>
      name === "_medusa_cart_id" && browser.cart ? { value: browser.cart } : undefined,
  }),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: async () => ({ id: "reg_ng" }) }))
vi.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: medusa.fetch },
    store: { cart: { create: medusa.create, createLineItem: medusa.createLineItem } },
  },
}))

import { getCartId, setCartId } from "../cookies"
import { addToCart, getCartQuantity, retrieveCart } from "../cart"

const addItem = () => addToCart({ variantId: "variant_1", quantity: 1, countryCode: "ng" })

beforeEach(async () => {
  vi.stubEnv("RECEIPT_ACCESS_SECRET", "a".repeat(64))
  browser.cart = undefined
  medusa.fetch.mockReset()
  medusa.create.mockReset().mockResolvedValue({ cart: { id: "cart_new", region_id: "reg_ng" } })
  medusa.createLineItem.mockReset().mockResolvedValue({})
  await setCartId("cart_existing")
})
afterEach(() => {
  vi.unstubAllEnvs()
})

it.each([
  ["a server error", new FetchError("Internal Server Error", "Internal Server Error", 500)],
  ["a network failure", new TypeError("fetch failed")],
])("keeps the existing cart when retrieval fails with %s", async (_, error) => {
  medusa.fetch.mockRejectedValue(error)

  await expect(addItem()).rejects.toBe(error)

  expect(medusa.create).not.toHaveBeenCalled()
  expect(medusa.createLineItem).not.toHaveBeenCalled()
  expect(await getCartId()).toBe("cart_existing")
})

it("starts a new cart when the stored cart no longer exists", async () => {
  medusa.fetch.mockRejectedValue(new FetchError("Cart not found", "Not Found", 404))

  await addItem()

  expect(medusa.create).toHaveBeenCalledOnce()
  expect(medusa.createLineItem).toHaveBeenCalledWith(
    "cart_new",
    { variant_id: "variant_1", quantity: 1 },
    {},
    {},
  )
  expect(await getCartId()).toBe("cart_new")
})

it("forgets a cart cookie whose cart no longer exists", async () => {
  medusa.fetch.mockRejectedValue(new FetchError("Cart not found", "Not Found", 404))

  expect(await retrieveCart()).toBeNull()
  expect(await getCartId()).toBeUndefined()
})

it("shows an empty cart badge instead of failing the page when the backend is down", async () => {
  medusa.fetch.mockRejectedValue(new TypeError("fetch failed"))

  expect(await getCartQuantity()).toBe(0)
  expect(await getCartId()).toBe("cart_existing")
})
