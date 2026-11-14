import * as React from "react"
import { Metadata } from "next"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { twMerge } from "tailwind-merge"

import { listOrders } from "@lib/data/orders"
import { Pagination } from "@modules/store/components/pagination"
import { ButtonLink } from "@/components/Button"
import { UiTag } from "@/components/ui/Tag"
import { LocalizedLink } from "@/components/LocalizedLink"
import { getCustomer } from "@lib/data/customer"
import { redirect } from "next/navigation"
import { formatOrderDate, getOrderStage } from "@lib/util/order-format"

export const metadata: Metadata = {
  title: "Account - Orders",
  description: "Check your order history",
}

const OrderStatus: React.FC<{
  order: HttpTypes.StoreOrder
  className?: string
}> = ({ order, className }) => {
  const stage = getOrderStage(order)
  const tag = {
    canceled: { icon: "close", label: "Canceled" },
    delivered: { icon: "check", label: "Delivered" },
    shipped: { icon: "truck", label: "Delivering" },
    processing: { icon: "package", label: "Packing" },
  } as const

  return (
    <UiTag iconName={tag[stage].icon} isActive className={twMerge("self-start mt-auto", className)}>
      {tag[stage].label}
    </UiTag>
  )
}

type PageProps = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{
    page?: string | string[]
  }>
}

const ORDERS_PER_PAGE = 6

export default async function AccountMyOrdersPage({ params, searchParams }: PageProps) {
  const { countryCode } = await params
  const { page } = await searchParams

  const customer = await getCustomer().catch(() => null)

  if (!customer) {
    redirect(
      `/${countryCode}/auth/login?redirect=${encodeURIComponent(`/${countryCode}/account/my-orders`)}`,
    )
  }

  const ordersPath = `/${countryCode}/account/my-orders`
  const pageNumber =
    page === undefined
      ? 1
      : typeof page === "string" && /^[1-9]\d*$/.test(page)
        ? Number(page)
        : NaN
  const offset = (pageNumber - 1) * ORDERS_PER_PAGE
  if (!Number.isSafeInteger(pageNumber) || !Number.isSafeInteger(offset)) {
    redirect(`${ordersPath}?page=1`)
  }
  const { orders, count } = await listOrders(ORDERS_PER_PAGE, offset)
  const totalPages = Math.max(1, Math.ceil(count / ORDERS_PER_PAGE))
  if (pageNumber > totalPages) {
    redirect(`${ordersPath}?page=${totalPages}`)
  }

  return (
    <>
      <h1 className="text-md md:text-lg mb-8 md:mb-13">My orders</h1>
      {orders.length > 0 ? (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-8 sm:gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xs border border-grayscale-200 flex flex-col gap-6 sm:gap-8 md:gap-6 lg:gap-8 p-4"
              >
                <div className="flex max-sm:flex-col-reverse md:flex-col-reverse lg:flex-row gap-y-6 gap-x-10 justify-between">
                  <div className="shrink-0">
                    <OrderStatus order={order} className="sm:hidden mb-6" />
                    <div className="mb-2">
                      <LocalizedLink href={`/account/my-orders/${order.id}`} className="text-md">
                        <span className="font-semibold">Order #{order.display_id}</span>
                      </LocalizedLink>
                    </div>
                    <p className="text-grayscale-500">
                      Order date: {formatOrderDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-3 overflow-x-auto sm:max-w-91 md:max-w-full lg:max-w-91">
                    {order.items
                      ?.filter((item) => item.thumbnail)
                      .map((item) => (
                        <LocalizedLink
                          key={item.id}
                          href={`/products/${item.product_handle}`}
                          className="shrink-0 w-19 aspect-3/4 rounded-2xs relative overflow-hidden"
                        >
                          <Image
                            src={item.thumbnail!}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        </LocalizedLink>
                      ))}
                  </div>
                </div>
                <div className="flex max-sm:flex-col justify-between gap-6">
                  <OrderStatus order={order} className="max-sm:hidden" />
                  <ButtonLink
                    href={`/account/my-orders/${order.id}`}
                    variant="outline"
                    size="md"
                    className="sm:self-end md:self-start lg:self-end sm:hidden"
                  >
                    Check details
                  </ButtonLink>
                  <ButtonLink
                    href={`/account/my-orders/${order.id}`}
                    variant="outline"
                    size="sm"
                    className="sm:self-end md:self-start lg:self-end max-sm:hidden"
                  >
                    Check details
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : count === 0 ? (
        <p className="text-md mt-16">You haven&apos;t ordered anything yet</p>
      ) : (
        <p className="text-md mt-16">
          We couldn&apos;t load orders on this page.{" "}
          <LocalizedLink href="/account/my-orders?page=1" className="underline">
            Return to the first page
          </LocalizedLink>{" "}
          to try again.
        </p>
      )}
      {count > 0 && totalPages > 1 && <Pagination page={pageNumber} totalPages={totalPages} />}
    </>
  )
}
