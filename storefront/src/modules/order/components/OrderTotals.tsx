import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

export const OrderTotals: React.FC<{
  order: HttpTypes.StoreOrder
}> = ({ order }) => {
  const {
    currency_code,
    total,
    item_subtotal,
    tax_total,
    shipping_subtotal,
    discount_total,
    gift_card_total,
  } = order

  return (
    <div className="sm:max-w-65 w-full flex-1">
      <div className="flex justify-between gap-4 mb-2">
        <div className="text-grayscale-500">
          <p>Subtotal</p>
        </div>
        <div className="self-end">
          <p>
            {convertToLocale({
              currency_code,
              amount: item_subtotal ?? 0,
            })}
          </p>
        </div>
      </div>
      {!!discount_total && (
        <div className="flex justify-between gap-4 mb-2">
          <div className="text-grayscale-500">
            <p>Discount</p>
          </div>
          <div className="self-end">
            <p>
              -{" "}
              {convertToLocale({ amount: discount_total ?? 0, currency_code })}
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-between gap-4 mb-2">
        <div className="text-grayscale-500">
          <p>Shipping</p>
        </div>
        <div className="self-end">
          <p>
            {convertToLocale({
              currency_code,
              amount: shipping_subtotal ?? 0,
            })}
          </p>
        </div>
      </div>
      <div className="flex justify-between gap-4 mb-2">
        <div className="text-grayscale-500">
          <p>VAT</p>
        </div>
        <div className="self-end">
          <p>{convertToLocale({ amount: tax_total ?? 0, currency_code })}</p>
        </div>
      </div>
      {!!gift_card_total && (
        <div className="flex justify-between gap-4 mb-2">
          <div className="text-grayscale-500">
            <p>Gift card</p>
          </div>
          <div className="self-end">
            <p>
              -{" "}
              {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-between gap-4 text-md mb-1 mt-6">
        <div>
          <p>Total</p>
        </div>
        <div className="self-end">
          <p>
            {convertToLocale({
              currency_code,
              amount: total ?? 0,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
