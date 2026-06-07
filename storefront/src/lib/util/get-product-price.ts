import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "@lib/util/get-precentage-diff"
import { convertToLocale } from "@lib/util/money"

export const getPricesForVariant = (variant: HttpTypes.StoreProductVariant) => {
  if (!variant?.calculated_price?.calculated_amount) {
    return null
  }

  return {
    calculated_price_number: variant.calculated_price.calculated_amount,
    calculated_price: convertToLocale({
      amount: variant.calculated_price.calculated_amount,
      currency_code: variant.calculated_price.currency_code ?? "",
    }),
    original_price_number: variant.calculated_price.original_amount,
    original_price: convertToLocale({
      amount: variant.calculated_price.original_amount ?? 0,
      currency_code: variant.calculated_price.currency_code ?? "",
    }),
    currency_code: variant.calculated_price.currency_code,
    price_type: variant.calculated_price.calculated_price?.price_list_type,
    percentage_diff: getPercentageDiff(
      variant.calculated_price.original_amount ?? 0,
      variant.calculated_price.calculated_amount
    ),
  }
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  const pricedVariants = product?.variants?.filter((v) => !!v.calculated_price) ?? []

  // Single O(N) scan to find cheapest and most expensive — avoids two separate sorts
  let minVariant: HttpTypes.StoreProductVariant | undefined
  let maxVariant: HttpTypes.StoreProductVariant | undefined
  for (const v of pricedVariants) {
    const amount = v.calculated_price?.calculated_amount ?? 0
    if (minVariant === undefined || amount < (minVariant.calculated_price?.calculated_amount ?? 0)) {
      minVariant = v
    }
    if (maxVariant === undefined || amount > (maxVariant.calculated_price?.calculated_amount ?? 0)) {
      maxVariant = v
    }
  }

  const cheapestPrice = minVariant ? getPricesForVariant(minVariant) : null

  const mostExpensivePrice = (() => {
    if (pricedVariants.length < 2 || !maxVariant) return null
    const price = getPricesForVariant(maxVariant)
    if (!price || !cheapestPrice) return null
    return price.calculated_price_number !== cheapestPrice.calculated_price_number ? price : null
  })()

  const variantPrice = (() => {
    if (!variantId) return null
    const variant = product.variants?.find((v) => v.id === variantId || v.sku === variantId)
    return variant ? getPricesForVariant(variant) : null
  })()

  return {
    product,
    cheapestPrice,
    mostExpensivePrice,
    variantPrice,
  }
}
