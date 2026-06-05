"use client"

import dynamic from "next/dynamic"

const CheckoutForm = dynamic(
  () => import("@modules/checkout/components/checkout-form").then((m) => m.CheckoutForm),
  { ssr: false }
)

export const CheckoutFormClientWrapper = ({
  countryCode,
  step,
}: {
  countryCode: string
  step: string | undefined
}) => {
  return <CheckoutForm countryCode={countryCode} step={step} />
}
