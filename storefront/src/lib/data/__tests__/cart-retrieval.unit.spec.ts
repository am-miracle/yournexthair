import { FetchError } from "@medusajs/js-sdk"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const browser = vi.hoisted(() => ({ cart: undefined as string | undefined }))
const medusa = vi.hoisted(() => ({
  fetch: vi.fn(),
  create: vi.fn(),
  createLineItem: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
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
vi.mock("@lib/data/regions", () => ({
  getRegion: async (country: string) => {
    if (country === "ng")
      return { id: "reg_ng", currency_code: "ngn", countries: [{ iso_2: "ng" }] }
    if (country === "us")
      return { id: "reg_us", currency_code: "usd", countries: [{ iso_2: "us" }, { iso_2: "gb" }] }
    return undefined
  },
}))
vi.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: medusa.fetch },
    store: {
      cart: {
        create: medusa.create,
        createLineItem: medusa.createLineItem,
        retrieve: medusa.retrieve,
        update: medusa.update,
      },
    },
  },
}))

import { getCartId, setCartId } from "../cookies"
import { addToCart, getCartQuantity, retrieveCart, setAddresses } from "../cart"

const addItem = () => addToCart({ variantId: "variant_1", quantity: 1, countryCode: "ng" })

beforeEach(async () => {
  vi.stubEnv("RECEIPT_ACCESS_SECRET", "a".repeat(64))
  browser.cart = undefined
  medusa.fetch.mockReset()
  medusa.retrieve.mockReset()
  medusa.update.mockReset().mockResolvedValue({ cart: {} })
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

const shippingAddress = {
  first_name: "Ada",
  last_name: "Jones",
  address_1: "1 Main Street",
  city: "Abuja",
  province: "Federal Capital Territory",
  postal_code: "900001",
  phone: "08000000000",
  country_code: "ng",
}

it("moves a dollar cart to the single-country naira region before saving the full address", async () => {
  medusa.retrieve.mockResolvedValue({ cart: { id: "cart_existing", region_id: "reg_us" } })

  await expect(
    setAddresses({ shipping_address: shippingAddress, same_as_billing: "on" }),
  ).resolves.toMatchObject({ success: true, countryCode: "ng" })

  expect(medusa.update).toHaveBeenCalledTimes(2)
  expect(medusa.update.mock.calls[0]?.[1]).toEqual({ region_id: "reg_ng" })
  expect(medusa.update.mock.calls[1]?.[1]).toMatchObject({
    shipping_address: { ...shippingAddress, province: "fct" },
    billing_address: { country_code: "ng" },
  })
})

it("moves a naira cart to the dollar region with the international address", async () => {
  medusa.retrieve.mockResolvedValue({ cart: { id: "cart_existing", region_id: "reg_ng" } })
  const address = { ...shippingAddress, country_code: "us", city: "New York", province: "NY" }

  await expect(
    setAddresses({ shipping_address: address, same_as_billing: "on" }),
  ).resolves.toMatchObject({ success: true, countryCode: "us" })

  expect(medusa.update).toHaveBeenCalledOnce()
  expect(medusa.update.mock.calls[0]?.[1]).toMatchObject({
    region_id: "reg_us",
    shipping_address: address,
  })
})

it("keeps the cart intact for an unsupported delivery country", async () => {
  const address = { ...shippingAddress, country_code: "xx" }
  await expect(
    setAddresses({ shipping_address: address, same_as_billing: "on" }),
  ).resolves.toMatchObject({ success: false })
  expect(medusa.update).not.toHaveBeenCalled()
})
