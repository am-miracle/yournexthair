import { getProductPrice } from "@lib/util/get-product-price"
import { withDefinedProp } from "@lib/util/optional-props"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, mostExpensivePrice, variantPrice } = getProductPrice({
    product,
    ...withDefinedProp("variantId", variant?.id),
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-grayscale-50 animate-pulse" />
  }

  const hasReducedPrice =
    selectedPrice.calculated_price_number <
    (selectedPrice.original_price_number ?? 0)

  if (hasReducedPrice && variant) {
    return (
      <div>
        <p className="text-sm mb-1 text-grayscale-500 line-through">
          {selectedPrice.original_price}
        </p>
        <p className="text-md mb-8 text-red-primary">
          {selectedPrice.calculated_price}
        </p>
      </div>
    )
  }

  return (
    <p className="text-md mb-8">
      {!variant && mostExpensivePrice
        ? `${selectedPrice.calculated_price} – ${mostExpensivePrice.calculated_price}`
        : selectedPrice.calculated_price}
    </p>
  )
}
