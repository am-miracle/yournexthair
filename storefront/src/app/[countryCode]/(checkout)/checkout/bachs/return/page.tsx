import { Metadata } from "next"

import { getCartId } from "@lib/data/cookies"
import BachsReturn from "@modules/checkout/components/bachs-return"

export const metadata: Metadata = {
  title: "Confirming payment",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function BachsReturnPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params

  if (!(await getCartId())) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h1 className="text-md font-semibold">We couldn’t restore your checkout session</h1>
        <p>
          If you completed your payment, check your email for an order confirmation. Please contact
          us before attempting another payment.
        </p>
        <a href="mailto:yournexthair@gmail.com" className="text-accent underline">
          Contact YourNextHair
        </a>
      </div>
    )
  }

  return <BachsReturn countryCode={countryCode} />
}
