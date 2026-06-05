"use client"
import React from "react"
import { useRouter } from "next/navigation"

import Wrapper from "@modules/checkout/components/payment-wrapper"
import Email from "@modules/checkout/components/email"
import Addresses from "@modules/checkout/components/addresses"
import Shipping from "@modules/checkout/components/shipping"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import { useCart } from "@/hooks/cart"
import { getCheckoutStep } from "@modules/cart/utils/getCheckoutStep"
import { Icon } from "@/components/Icon"

export const CheckoutForm = ({
  countryCode,
  step,
}: {
  countryCode: string
  step: string | undefined
}) => {
  const { data: cart, isPending } = useCart({ enabled: true })
  const router = useRouter()
  React.useEffect(() => {
    if (!step && cart) {
      const checkoutStep = getCheckoutStep(cart)
      router.push(`/${countryCode}/checkout?step=${checkoutStep}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, countryCode, cart])
  if (isPending) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center rounded-4xl border border-grayscale-200 bg-white">
        <Icon name="loader" className="w-10 md:w-20 animate-spin" />
      </div>
    )
  }

  if (!cart) {
    return null
  }

  return (
    <Wrapper cart={cart}>
      <Email countryCode={countryCode} cart={cart} />
      <Addresses cart={cart} />
      <Shipping cart={cart} />
      <Payment cart={cart} />
      <Review cart={cart} />
    </Wrapper>
  )
}
