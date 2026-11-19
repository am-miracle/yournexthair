"use client"

import type { StoreRegion } from "@medusajs/types"
import dynamic from "next/dynamic"

const CheckoutForm = dynamic(
  () => import("@modules/checkout/components/checkout-form").then((m) => m.CheckoutForm),
  { ssr: false },
)

export const CheckoutFormClientWrapper = ({
  countryCode,
  step,
  countries,
}: {
  countryCode: string
  step: string | undefined
  countries: NonNullable<StoreRegion["countries"]>
}) => {
  return <CheckoutForm countryCode={countryCode} step={step} countries={countries} />
}
