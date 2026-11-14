import type { Metadata } from "next"

import { Layout, LayoutColumn } from "@/components/Layout"
import { getCustomer } from "@lib/data/customer"
import { ClaimOrders } from "@modules/order/components/ClaimOrders"

export const metadata: Metadata = {
  title: "Add past orders",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function ClaimOrdersPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const customer = await getCustomer().catch(() => null)
  return (
    <Layout className="py-26 md:pt-39 md:pb-36">
      <LayoutColumn start={{ base: 1, lg: 3, xl: 4 }} end={{ base: 13, lg: 11, xl: 10 }}>
        <ClaimOrders signedIn={Boolean(customer)} countryCode={countryCode} />
      </LayoutColumn>
    </Layout>
  )
}
