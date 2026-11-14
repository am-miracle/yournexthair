import * as React from "react"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { retrieveOrder } from "@lib/data/orders"
import { getCustomer } from "@lib/data/customer"
import { formatOrderDate, getOrderStage } from "@lib/util/order-format"
import { OrderTotals } from "@modules/order/components/OrderTotals"
import { OrderAddresses } from "@modules/order/components/OrderAddresses"
import { OrderDelivery } from "@modules/order/components/OrderDelivery"
import PaymentDetails from "@modules/order/components/payment-details"
import { PrintReceiptButton } from "@modules/order/components/PrintReceiptButton"
import Item from "@modules/order/components/item"
import { UiTag } from "@/components/ui/Tag"
import { UiTagList, UiTagListDivider } from "@/components/ui/TagList"
import { Icon } from "@/components/Icon"

export const metadata: Metadata = {
  title: "Account - Order",
  description: "Check your order history",
}

const OrderStatus: React.FC<{ order: HttpTypes.StoreOrder }> = ({ order }) => {
  const stage = getOrderStage(order)

  if (stage === "canceled") {
    return (
      <UiTagList>
        <UiTag iconName="close" isActive className="self-start mt-auto">
          Canceled
        </UiTag>
      </UiTagList>
    )
  }

  return (
    <UiTagList>
      <UiTag isActive iconName="package" className="self-start mt-auto">
        Packing
      </UiTag>
      <UiTagListDivider />
      <UiTag
        isActive={stage === "shipped" || stage === "delivered"}
        iconName="truck"
        className="self-start mt-auto"
      >
        Delivering
      </UiTag>
      <UiTagListDivider />
      <UiTag isActive={stage === "delivered"} iconName="check" className="self-start mt-auto">
        Delivered
      </UiTag>
    </UiTagList>
  )
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderId: string; countryCode: string }>
}) {
  const { orderId, countryCode } = await params
  const customer = await getCustomer().catch(() => null)

  if (!customer) {
    redirect(
      `/${countryCode}/auth/login?redirect=${encodeURIComponent(`/${countryCode}/account/my-orders/${orderId}`)}`,
    )
  }

  const order = await retrieveOrder(orderId).catch(() => null)
  if (!order || order.customer_id !== customer.id) {
    notFound()
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 md:mb-16">
        <h1 className="text-md md:text-lg">Order #{order.display_id}</h1>
        <PrintReceiptButton />
      </div>
      <div className="flex flex-col gap-6">
        <div className="rounded-xs border border-grayscale-200 flex flex-wrap justify-between p-4">
          <div className="flex gap-4 items-center">
            <Icon name="calendar" />
            <p className="text-grayscale-500">Order date</p>
          </div>
          <p>{formatOrderDate(order.created_at)}</p>
        </div>
        <div className="rounded-xs border border-grayscale-200 p-4 print:hidden">
          <div className="flex flex-wrap gap-x-10 gap-y-8 justify-between items-end w-full">
            <OrderStatus order={order} />
          </div>
        </div>
        <OrderAddresses order={order} />
        <OrderDelivery order={order} />
        <div className="rounded-xs border border-grayscale-200 p-4">
          <ul>
            {order.items?.map((item) => (
              <Item key={item.id} item={item} currencyCode={order.currency_code} />
            ))}
          </ul>
        </div>
        <div className="rounded-xs border border-grayscale-200 p-4 flex max-sm:flex-col gap-y-8 gap-x-10 md:flex-wrap justify-between">
          <div className="flex self-baseline gap-4">
            <Icon name="credit-card" />
            <div className="flex flex-col gap-2">
              <p className="text-grayscale-500">Payment</p>
              <PaymentDetails order={order} />
            </div>
          </div>
          <OrderTotals order={order} />
        </div>
      </div>
    </>
  )
}
