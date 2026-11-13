import { HttpTypes } from "@medusajs/types"

import { Icon } from "@/components/Icon"

type Quote = { carrier?: unknown; delivery_time?: unknown }
type Label = { tracking_number?: string | null; tracking_url?: string | null }

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

export const OrderDelivery = ({ order }: { order: HttpTypes.StoreOrder }) => {
  const method = order.shipping_methods?.[0]
  if (!method) return null

  const quote = (method.data as { terminal_quote?: Quote } | null)?.terminal_quote
  const carrier = text(quote?.carrier)
  const eta = text(quote?.delivery_time)
  const fulfillments = (order as { fulfillments?: { labels?: Label[] | null }[] | null }).fulfillments ?? []
  const tracking = fulfillments
    .flatMap((fulfillment) => fulfillment.labels ?? [])
    .filter((label) => text(label.tracking_number))
  const international = Boolean(
    order.shipping_address?.country_code && order.shipping_address.country_code.toLowerCase() !== "ng"
  )

  return (
    <div className="rounded-xs border border-grayscale-200 p-4 flex max-sm:flex-col gap-y-4 gap-x-10 justify-between">
      <div className="flex items-center self-baseline gap-4">
        <Icon name="truck" />
        <p className="text-grayscale-500">Delivery</p>
      </div>
      <div className="sm:max-w-65 w-full flex-1 flex flex-col gap-1">
        <p>{method.name}</p>
        {carrier && <p className="text-grayscale-500">Courier: {carrier}</p>}
        {eta && <p className="text-grayscale-500">Estimated delivery: {eta}</p>}
        {tracking.map((label) => {
          const url = text(label.tracking_url)
          return (
            <p key={label.tracking_number} className="text-grayscale-500">
              Tracking:{" "}
              {url?.startsWith("https://") ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-black">
                  {label.tracking_number}
                </a>
              ) : (
                <span className="text-black">{label.tracking_number}</span>
              )}
            </p>
          )
        })}
        {international && (
          <p className="text-grayscale-500 text-xs mt-2">
            Import duties and taxes may be charged by your country on delivery. These are not included in
            your order total.
          </p>
        )}
      </div>
    </div>
  )
}
