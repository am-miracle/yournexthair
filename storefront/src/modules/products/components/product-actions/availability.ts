import { HttpTypes } from "@medusajs/types"
import { getVariantItemsInStock } from "@lib/util/inventory"

/**
 * Single O(V × O) pass over all variants to build a Map from each option ID to
 * the set of values that have at least one in-stock variant, given the current
 * selection of all *other* options.
 *
 * Replaces calling a per-option scanner in the render loop, which was O(N × V)
 * with repeated work.
 */
export function buildAvailabilityMap(
  variants: HttpTypes.StoreProductVariant[],
  currentOptions: Record<string, string | undefined>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()

  for (const variant of variants) {
    if (getVariantItemsInStock(variant) === 0) continue

    const variantOpts: Record<string, string> = {}
    for (const o of variant.options ?? []) {
      if (o.option_id && o.value) variantOpts[o.option_id] = o.value
    }

    for (const optionId of Object.keys(variantOpts)) {
      // Does this variant match all currently-selected options except this one?
      const matchesOthers = Object.entries(currentOptions).every(([id, val]) => {
        if (id === optionId || !val) return true
        return variantOpts[id] === val
      })
      if (!matchesOthers) continue

      const val = variantOpts[optionId]
      if (!val) continue
      if (!map.has(optionId)) map.set(optionId, new Set())
      map.get(optionId)!.add(val)
    }
  }

  return map
}
