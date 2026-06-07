import { describe, it, expect } from "vitest"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "../get-product-price"

const makeVariant = (
  id: string,
  amount: number,
  currency = "GBP",
): HttpTypes.StoreProductVariant =>
  ({
    id,
    calculated_price: {
      calculated_amount: amount,
      original_amount: amount,
      currency_code: currency,
      calculated_price: {},
    },
  }) as unknown as HttpTypes.StoreProductVariant

const makeProduct = (
  variants: HttpTypes.StoreProductVariant[],
): HttpTypes.StoreProduct =>
  ({ id: "prod_1", variants }) as unknown as HttpTypes.StoreProduct

describe("getProductPrice", () => {
  it("throws when no product is provided", () => {
    expect(() => getProductPrice({ product: null as never })).toThrow("No product provided")
  })

  it("returns null prices when there are no priced variants", () => {
    const product = makeProduct([{ id: "v1" } as unknown as HttpTypes.StoreProductVariant])
    const { cheapestPrice, mostExpensivePrice, variantPrice } = getProductPrice({ product })
    expect(cheapestPrice).toBeNull()
    expect(mostExpensivePrice).toBeNull()
    expect(variantPrice).toBeNull()
  })

  it("returns cheapestPrice for a single variant", () => {
    const product = makeProduct([makeVariant("v1", 189_00)])
    const { cheapestPrice, mostExpensivePrice } = getProductPrice({ product })
    expect(cheapestPrice?.calculated_price_number).toBe(18900)
    expect(mostExpensivePrice).toBeNull()
  })

  it("returns null mostExpensivePrice when all variants have the same price", () => {
    const product = makeProduct([makeVariant("v1", 200_00), makeVariant("v2", 200_00)])
    const { mostExpensivePrice } = getProductPrice({ product })
    expect(mostExpensivePrice).toBeNull()
  })

  it("returns the correct cheapest and most expensive across multiple variants", () => {
    const product = makeProduct([
      makeVariant("v1", 349_00),
      makeVariant("v2", 189_00),
      makeVariant("v3", 259_00),
    ])
    const { cheapestPrice, mostExpensivePrice } = getProductPrice({ product })
    expect(cheapestPrice?.calculated_price_number).toBe(18900)
    expect(mostExpensivePrice?.calculated_price_number).toBe(34900)
  })

  it("handles a reversed list (large first) and still finds min/max correctly", () => {
    const product = makeProduct([
      makeVariant("v1", 500_00),
      makeVariant("v2", 100_00),
      makeVariant("v3", 300_00),
    ])
    const { cheapestPrice, mostExpensivePrice } = getProductPrice({ product })
    expect(cheapestPrice?.calculated_price_number).toBe(10000)
    expect(mostExpensivePrice?.calculated_price_number).toBe(50000)
  })

  it("returns the exact variant price when variantId is provided", () => {
    const product = makeProduct([
      makeVariant("v1", 189_00),
      makeVariant("v2", 349_00),
    ])
    const { variantPrice } = getProductPrice({ product, variantId: "v2" })
    expect(variantPrice?.calculated_price_number).toBe(34900)
  })

  it("returns null variantPrice when variantId is not found", () => {
    const product = makeProduct([makeVariant("v1", 189_00)])
    const { variantPrice } = getProductPrice({ product, variantId: "v_missing" })
    expect(variantPrice).toBeNull()
  })

  it("returns null variantPrice when no variantId is given", () => {
    const product = makeProduct([makeVariant("v1", 189_00)])
    const { variantPrice } = getProductPrice({ product })
    expect(variantPrice).toBeNull()
  })

  it("skips variants without a calculated_price", () => {
    const unpriced = { id: "v_unpriced" } as unknown as HttpTypes.StoreProductVariant
    const product = makeProduct([unpriced, makeVariant("v2", 250_00)])
    const { cheapestPrice } = getProductPrice({ product })
    expect(cheapestPrice?.calculated_price_number).toBe(25000)
  })
})
