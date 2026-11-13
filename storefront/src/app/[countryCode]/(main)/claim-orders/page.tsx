import type { Metadata } from "next"

import { Layout, LayoutColumn } from "@/components/Layout"
import { ClaimOrders } from "@modules/order/components/ClaimOrders"

export const metadata: Metadata = {
  title: "Add past orders",
  robots: {
    index: false,
    follow: false,
  },
}

export default function ClaimOrdersPage() {
  return (
    <Layout className="py-26 md:pt-39 md:pb-36">
      <LayoutColumn start={{ base: 1, lg: 3, xl: 4 }} end={{ base: 13, lg: 11, xl: 10 }}>
        <ClaimOrders />
      </LayoutColumn>
    </Layout>
  )
}
