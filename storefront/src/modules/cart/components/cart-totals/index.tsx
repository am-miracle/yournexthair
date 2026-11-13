"use client"

import { HttpTypes } from "@medusajs/types"
import React from "react"

import { convertToLocale } from "@lib/util/money"
import { twJoin, twMerge } from "tailwind-merge"

type CartTotalsProps = {
  cart: HttpTypes.StoreCart
  isPartOfCartDrawer?: boolean
  className?: string
}

const CartTotals: React.FC<CartTotalsProps> = ({
  cart,
  isPartOfCartDrawer,
  className,
}) => {
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
    <div className={className}>
      <div
        className={twMerge(
          "flex flex-col gap-4",
          isPartOfCartDrawer && "gap-2"
        )}
      >
        <div className="flex justify-between">
          <p className="text-grayscale-500">Subtotal:</p>
          <p
            className="self-end"
            data-testid="cart-subtotal"
            data-value={item_subtotal || 0}
          >
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </p>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <p className="text-grayscale-500">Discount:</p>
            <p
              className="self-end"
              data-testid="cart-discount"
              data-value={discountAmount}
            >
              -{" "}
              {convertToLocale({ amount: discountAmount, currency_code })}
            </p>
          </div>
        )}
        <div className="flex justify-between">
          <p className="text-grayscale-500">
            Shipping{shipping_tax_total ? " (incl. VAT)" : ""}:
          </p>
          <p
            className="self-end"
            data-testid="cart-shipping"
            data-value={shippingAmount}
          >
            {hasShipping
              ? convertToLocale({ amount: shippingAmount, currency_code })
              : "Calculated at checkout"}
          </p>
        </div>
        {!!item_tax_total && (
          <div className="flex justify-between">
            <p className="text-grayscale-500">VAT:</p>
            <p
              className="self-end"
              data-testid="cart-taxes"
              data-value={item_tax_total}
            >
              {convertToLocale({ amount: item_tax_total, currency_code })}
            </p>
          </div>
        )}
        {!!gift_card_total && (
          <div className="flex justify-between">
            <p className="text-grayscale-500">Gift card:</p>
            <p
              className="self-end"
              data-testid="cart-gift-card-amount"
              data-value={gift_card_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </p>
          </div>
        )}
      </div>
      <hr
        className={twJoin(
          "my-8 md:my-6 text-grayscale-200",
          isPartOfCartDrawer && "my-4 md:my-4"
        )}
      />
      <div className="flex justify-between text-md font-semibold">
        <p>Total:</p>
        <p data-testid="cart-total" data-value={total || 0}>
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </p>
      </div>
    </div>
  )
}

export default CartTotals
