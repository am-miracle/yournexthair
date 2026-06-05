"use client"

import * as React from "react"
import { HttpTypes } from "@medusajs/types"

import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Icon } from "@/components/Icon"
import { convertToLocale } from "@lib/util/money"

const MobileCheckoutSummary = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const { currency_code, total } = cart
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const onClickHandler = React.useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((event) => {
    event.preventDefault()

    const button = event.currentTarget
    const wrapper = wrapperRef.current
    if (!wrapper || !button) {
      return
    }

    const currentHeight = wrapper.clientHeight
    const isOpen = currentHeight > 0
    const newHeight = !isOpen ? wrapper.scrollHeight : 0

    wrapper.style.height = `${currentHeight}px`
    wrapper.style.overflow = "hidden"

    requestAnimationFrame(() => {
      button.dataset.open = isOpen ? "no" : "yes"
      wrapper.style.height = `${newHeight}px`
    })
  }, [])

  return (
    <>
      <button
        type="button"
        className="group flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left"
        onClick={onClickHandler}
        data-open="no"
      >
        <p className="font-medium">Order summary</p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-medium">{convertToLocale({ amount: total ?? 0, currency_code })}</span>
          <Icon
            name="chevron-down"
            className="w-6 group-data-[open=yes]:rotate-180 transition-transform"
          />
        </div>
      </button>
      <div
        className="overflow-hidden transition-[height]"
        ref={wrapperRef}
        style={{
          height: "0px",
        }}
      >
        <div className="border-t border-grayscale-200 py-6">
          <CheckoutSummary cart={cart} />
        </div>
      </div>
    </>
  )
}

export default MobileCheckoutSummary
