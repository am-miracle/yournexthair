import { HttpTypes } from "@medusajs/types"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedButtonLink } from "@/components/LocalizedLink"
import { Icon } from "@/components/Icon"
import Item from "@modules/order/components/item"
import { OrderTotals } from "@modules/order/components/OrderTotals"
import { OrderAddresses } from "@modules/order/components/OrderAddresses"
import { OrderDelivery } from "@modules/order/components/OrderDelivery"
import PaymentDetails from "@modules/order/components/payment-details"
import { PrintReceiptButton } from "@modules/order/components/PrintReceiptButton"
import { getCustomer } from "@lib/data/customer"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
  countryCode: string
}

export default async function OrderCompletedTemplate({ order }: OrderCompletedTemplateProps) {
  const customer = await getCustomer().catch(() => null)
  const ownsOrder = Boolean(customer && order.customer_id === customer.id)
  // Order retrieval has already been authorized by Medusa.

  return (
    <Layout className="py-26 md:pt-39 md:pb-36">
      <LayoutColumn start={{ base: 1, lg: 3, xl: 4 }} end={{ base: 13, lg: 11, xl: 10 }}>
        <h1 className="text-md md:text-2xl mb-8 md:mb-16">Thank you for your order!</h1>
        <p className="mb-4">
          Your order is confirmed. We&apos;ll let you know when it&apos;s on its way.
        </p>
        <p className="mb-8">
          Your order number is <strong>#{order.display_id}</strong>. We&apos;ve emailed your receipt
          to <strong>{order.email}</strong>.
        </p>
        <div className="flex gap-x-6 gap-y-4 max-sm:flex-col mb-16 print:hidden">
          {ownsOrder && (
            <LocalizedButtonLink href={`/account/my-orders/${order.id}`}>
              View in my account
            </LocalizedButtonLink>
          )}
          <LocalizedButtonLink href="/store" variant="outline">
            Continue shopping
          </LocalizedButtonLink>
          <PrintReceiptButton />
        </div>
        {!customer && (
          <div className="rounded-xs border border-grayscale-200 bg-grayscale-50 p-4 mb-5 print:hidden">
            <p className="font-semibold mb-2">Track this order with an account</p>
            <p className="text-grayscale-500 mb-4">
              Create an account with <strong className="text-black">{order.email}</strong> and
              we&apos;ll email you a link to add this order to your order history.
            </p>
            <LocalizedButtonLink href="/auth/register" variant="outline">
              Create an account
            </LocalizedButtonLink>
          </div>
        )}
        <div className="flex flex-col gap-5">
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
      </LayoutColumn>
    </Layout>
  )
}
