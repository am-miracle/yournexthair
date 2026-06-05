import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCartId } from "@lib/data/cookies"
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

  return <CheckoutFormClientWrapper countryCode={countryCode} step={step} />
}
