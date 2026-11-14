import { Metadata } from "next"
import { notFound } from "next/navigation"

import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import { retrieveOrder } from "@lib/data/orders"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
}

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your purchase was successful",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function OrderConfirmedPage({ params }: Props) {
  const { id, countryCode } = await params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) {
    return notFound()
  }

  return <OrderCompletedTemplate order={order} countryCode={countryCode} />
}
