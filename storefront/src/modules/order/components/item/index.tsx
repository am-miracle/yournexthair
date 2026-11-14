import { LocalizedLink } from "@/components/LocalizedLink"
import { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"
import { twMerge } from "tailwind-merge"

type ItemProps = {
  item: HttpTypes.StoreOrderLineItem
  currencyCode: string
  className?: string
}

const Item = ({ item, currencyCode, className }: ItemProps) => {
  const title = item.product_title ?? item.title
  const thumbnail = <Thumbnail thumbnail={item.thumbnail} size="3/4" className="w-27 sm:w-37" />
  const options = Object.entries(item.variant_option_values ?? {}).filter(
    ([label, value]) =>
      label.trim() &&
      ((typeof value === "string" && value.trim()) ||
        (typeof value === "number" && Number.isFinite(value))),
  )

  return (
    <li
      className={twMerge(
        "flex gap-x-6 sm:gap-x-8 gap-y-6 mb-6 pb-6 border-b border-grayscale-100 last:border-0 last:mb-0 last:pb-0",
        className,
      )}
    >
      {item.product_handle ? (
        <LocalizedLink href={`/products/${item.product_handle}`} aria-label={`View ${title}`}>
          {thumbnail}
        </LocalizedLink>
      ) : (
        thumbnail
      )}
      <div className="flex flex-col flex-1">
        <p className="mb-2 sm:text-md">
          {item.product_handle ? (
            <LocalizedLink href={`/products/${item.product_handle}`}>{title}</LocalizedLink>
          ) : (
            title
          )}
        </p>
        <div className="text-xs flex flex-col flex-1">
          <div>
            {options.map(([label, value]) => (
              <p className="mb-1" key={label}>
                <span className="text-grayscale-500 mr-2">{label}:</span>
                {String(value)}
              </p>
            ))}
            {!options.length && item.variant_title && <p className="mb-1">{item.variant_title}</p>}
          </div>
          <div className="sm:mt-auto flex max-sm:flex-col gap-x-10 gap-y-6 max-sm:h-full sm:items-center justify-between relative">
            <div className="sm:self-end sm:mb-1">
              <p>
                <span className="text-grayscale-500 mr-2">Quantity:</span>
                {item.quantity}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-base sm:text-md">
                {convertToLocale({
                  amount: item.subtotal ?? item.unit_price * item.quantity,
                  currency_code: currencyCode,
                })}
              </p>
              {item.quantity > 1 && (
                <p className="text-grayscale-500">
                  {convertToLocale({ amount: item.unit_price, currency_code: currencyCode })} each
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

export default Item
