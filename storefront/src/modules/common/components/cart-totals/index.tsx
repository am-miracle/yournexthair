"use client"

import React from "react"
import { HttpTypes } from "@medusajs/types"

import { convertToLocale } from "@lib/util/money"

type CartTotalsProps = {
  cart: HttpTypes.StoreCart
}

const CartTotals: React.FC<CartTotalsProps> = ({ cart }) => {
  const {
    currency_code,
    total,
    item_subtotal,
    item_tax_total,
    shipping_subtotal,
    shipping_tax_total,
    discount_total,
    discount_tax_total,
    gift_card_total,
  } = cart
  const hasShipping = (cart.shipping_methods?.length ?? 0) > 0
  const discountAmount = (discount_total ?? 0) - (discount_tax_total ?? 0)
  const shippingAmount = (shipping_subtotal ?? 0) + (shipping_tax_total ?? 0)

  return (
    <div>
      <div className="flex flex-col gap-2 lg:gap-1 mb-8">
        <div className="flex justify-between max-lg:text-xs">
          <div>
            <p>Subtotal</p>
          </div>
          <div className="self-end">
            <p>{convertToLocale({ amount: item_subtotal ?? 0, currency_code })}</p>
          </div>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between max-lg:text-xs">
            <div>
              <p>Discount</p>
            </div>
            <div className="self-end">
              <p>
                -{" "}
                {convertToLocale({
                  amount: discountAmount,
                  currency_code,
                })}
              </p>
            </div>
          </div>
        )}
        <div className="flex justify-between max-lg:text-xs">
          <div>
            <p>Shipping{shipping_tax_total ? " (incl. VAT)" : ""}</p>
          </div>
          <div className="self-end">
            <p>
              {hasShipping
                ? convertToLocale({ amount: shippingAmount, currency_code })
                : "Calculated at checkout"}
            </p>
          </div>
        </div>
        {!!item_tax_total && (
          <div className="flex justify-between max-lg:text-xs">
            <div>
              <p>VAT</p>
            </div>
            <div className="self-end">
              <p>{convertToLocale({ amount: item_tax_total, currency_code })}</p>
            </div>
          </div>
        )}
        {!!gift_card_total && (
          <div className="flex justify-between max-lg:text-xs">
            <div>
              <p>Gift card</p>
            </div>
            <div className="self-end">
              <p>
                -{" "}
                {convertToLocale({
                  amount: gift_card_total ?? 0,
                  currency_code,
                })}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between text-md">
        <div>
          <p>Total</p>
        </div>
        <div className="self-end">
          <p>{convertToLocale({ amount: total ?? 0, currency_code })}</p>
        </div>
      </div>
      <div className="absolute h-full w-auto top-0 right-0 bg-black" />
    </div>
  )
}

export default CartTotals
