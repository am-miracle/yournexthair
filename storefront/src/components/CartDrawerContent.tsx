"use client"

import * as React from "react"
import { HttpTypes } from "@medusajs/types"

import { Icon } from "@/components/Icon"
import { LocalizedButtonLink, LocalizedLink } from "@/components/LocalizedLink"
import { useCart } from "@/hooks/cart"
import Item from "@modules/cart/components/item"
import CartTotals from "@modules/cart/components/cart-totals"
import DiscountCode from "@modules/cart/components/discount-code"
import { getCheckoutStep } from "@modules/cart/utils/getCheckoutStep"

type CartDrawerContentProps = {
  onClose: () => void
}

const CartDrawerContent: React.FC<CartDrawerContentProps> = ({ onClose }) => {
  const { data: cart, isPending } = useCart({ enabled: true })
  const step = getCheckoutStep(cart as HttpTypes.StoreCart)

  if (cart?.items?.length) {
    return (
      <>
        <div className="pb-8 pr-3 sm:pr-4 overflow-y-scroll">
          {cart.items
            .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
            .map((item) => (
              <Item key={item.id} item={item} className="py-8 last:pb-0 last:border-b-0" />
            ))}
        </div>
        <div className="sticky left-0 bg-white bottom-0 pt-4 border-t border-grayscale-200 mt-auto">
          <CartTotals isPartOfCartDrawer cart={cart} />
          <DiscountCode cart={cart} className="mt-6" />
          <LocalizedButtonLink
            href={`/checkout/?step=${step}`}
            isFullWidth
            className="mt-4"
          >
            Proceed to checkout
          </LocalizedButtonLink>
        </div>
      </>
    )
  }

  if (isPending) {
    return (
      <div className="flex align-middle justify-around items-center h-screen ">
        <Icon name="loader" className="w-10 md:w-15 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <p className="md:text-sm max-sm:mr-10 mb-6 mt-2">
        You don&apos;t have anything in your cart. Let&apos;s change that, use the link below
        to start browsing our products.
      </p>
      <div>
        <LocalizedLink href="/store" onClick={onClose}>
          Explore products
        </LocalizedLink>
      </div>
    </>
  )
}

export default CartDrawerContent
