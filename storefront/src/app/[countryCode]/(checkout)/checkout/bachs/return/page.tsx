import { Metadata } from "next"
import { redirect } from "next/navigation"

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
    redirect(`/${countryCode}`)
  }

  return <BachsReturn countryCode={countryCode} />
}
