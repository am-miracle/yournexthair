import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listRegions } from "@lib/data/regions"
import { getCartId } from "@lib/data/cookies"
import { checkoutCurrency } from "@lib/util/checkout-currency"
import { CheckoutFormClientWrapper } from "@modules/checkout/components/checkout-form/client-wrapper"

export const metadata: Metadata = {
  title: "Checkout",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const cart = await getCartId()
  if (!cart) {
    return notFound()
  }

  const { countryCode } = await params
  const { step } = await searchParams

  const regions = await listRegions()
  const countries = regions.flatMap((region) =>
    (region.countries ?? []).filter(
      (country) => country.iso_2 && region.currency_code === checkoutCurrency(country.iso_2),
    ),
  )

  return <CheckoutFormClientWrapper countryCode={countryCode} step={step} countries={countries} />
}
