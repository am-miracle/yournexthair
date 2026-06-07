import { describe, it, expect } from "vitest"
import { HttpTypes } from "@medusajs/types"
import { buildAvailabilityMap } from "../availability"

type VariantOptions = Record<string, string>

const makeVariant = (
  optionValues: VariantOptions,
  inStock = true,
): HttpTypes.StoreProductVariant =>
  ({
    manage_inventory: true,
    inventory_quantity: inStock ? 10 : 0,
    allow_backorder: false,
    options: Object.entries(optionValues).map(([option_id, value]) => ({ option_id, value })),
  }) as unknown as HttpTypes.StoreProductVariant

describe("buildAvailabilityMap", () => {
  it("returns an empty map when there are no variants", () => {
    const map = buildAvailabilityMap([], {})
    expect(map.size).toBe(0)
  })

  it("includes all in-stock option values when nothing is selected", () => {
    const variants = [
      makeVariant({ opt_length: '10"', opt_color: "Black" }),
      makeVariant({ opt_length: '14"', opt_color: "Brown" }),
    ]
    const map = buildAvailabilityMap(variants, {})
    expect(map.get("opt_length")).toEqual(new Set(['10"', '14"']))
    expect(map.get("opt_color")).toEqual(new Set(["Black", "Brown"]))
  })

  it("excludes out-of-stock variants", () => {
    const variants = [
      makeVariant({ opt_length: '10"' }, true),
      makeVariant({ opt_length: '14"' }, false),
    ]
    const map = buildAvailabilityMap(variants, {})
    expect(map.get("opt_length")).toEqual(new Set(['10"']))
    expect(map.get("opt_length")?.has('14"')).toBe(false)
  })

  it("filters by other selected options when computing availability for an option", () => {
    // opt_color:Black is only available at 10", opt_color:Brown only at 14"
    const variants = [
      makeVariant({ opt_length: '10"', opt_color: "Black" }),
      makeVariant({ opt_length: '14"', opt_color: "Brown" }),
    ]
    // With Black selected, only 10" should be available for length
    const map = buildAvailabilityMap(variants, { opt_color: "Black" })
    expect(map.get("opt_length")).toEqual(new Set(['10"']))
    expect(map.get("opt_length")?.has('14"')).toBe(false)
  })

  it("does not filter an option against itself", () => {
    const variants = [
      makeVariant({ opt_length: '10"', opt_color: "Black" }),
      makeVariant({ opt_length: '14"', opt_color: "Brown" }),
    ]
    // With 10" selected, opt_length's own available set should still contain 10"
    const map = buildAvailabilityMap(variants, { opt_length: '10"' })
    expect(map.get("opt_length")?.has('10"')).toBe(true)
  })

  it("treats manage_inventory:false as unlimited stock (always included)", () => {
    const unlimited: HttpTypes.StoreProductVariant = {
      manage_inventory: false,
      inventory_quantity: 0,
      options: [{ option_id: "opt_length", value: '20"' }],
    } as unknown as HttpTypes.StoreProductVariant
    const map = buildAvailabilityMap([unlimited], {})
    expect(map.get("opt_length")?.has('20"')).toBe(true)
  })

  it("merges values from multiple in-stock variants for the same option", () => {
    const variants = [
      makeVariant({ opt_length: '10"', opt_color: "Black" }),
      makeVariant({ opt_length: '10"', opt_color: "Brown" }),
      makeVariant({ opt_length: '14"', opt_color: "Blonde" }),
    ]
    // With 10" selected, both Black and Brown should be available for color
    const map = buildAvailabilityMap(variants, { opt_length: '10"' })
    expect(map.get("opt_color")).toEqual(new Set(["Black", "Brown"]))
    expect(map.get("opt_color")?.has("Blonde")).toBe(false)
  })

  it("ignores empty/missing option values", () => {
    const variant: HttpTypes.StoreProductVariant = {
      manage_inventory: false,
      options: [
        { option_id: "opt_a", value: "X" },
        { option_id: "", value: "Y" },   // no option_id
        { option_id: "opt_b", value: "" }, // empty value
      ],
    } as unknown as HttpTypes.StoreProductVariant
    const map = buildAvailabilityMap([variant], {})
    expect(map.has("opt_a")).toBe(true)
    expect(map.has("")).toBe(false)
    // opt_b key won't appear because the value is empty
    expect(map.get("opt_b")).toBeUndefined()
  })
})
