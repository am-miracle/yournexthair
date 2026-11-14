import { HttpTypes } from "@medusajs/types"

import { Icon } from "@/components/Icon"
import { formatAddressLines } from "@lib/util/order-format"

const AddressCard = ({
  title,
  icon,
  lines,
}: {
  title: string
  icon: "map-pin" | "receipt"
  lines: string[]
}) => (
  <div className="flex-1 overflow-hidden rounded-xs border border-grayscale-200 p-4">
    <div className="flex gap-4 items-center mb-8">
      <Icon name={icon} />
      <p className="text-grayscale-500">{title}</p>
    </div>
    <address className="not-italic">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </address>
  </div>
)

export const OrderAddresses = ({ order }: { order: HttpTypes.StoreOrder }) => {
  const shipping = formatAddressLines(order.shipping_address)
  const billing = formatAddressLines(order.billing_address)
  const sameBilling = billing.length === 0 || billing.join("\n") === shipping.join("\n")

  return (
    <div className="flex max-sm:flex-col gap-x-4 gap-y-4 md:flex-col lg:flex-row">
      <AddressCard
        title={sameBilling ? "Delivery and billing address" : "Delivery address"}
        icon="map-pin"
        lines={shipping}
      />
      {!sameBilling && <AddressCard title="Billing address" icon="receipt" lines={billing} />}
    </div>
  )
}
