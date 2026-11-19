import { z } from "zod"
import { DHL_PROVIDER_ID } from "../dhl-shipping/config"
import { type Carrier, carrierForProvider } from "../nigeria-shipping/config"

export const DISPATCH_STATES = ["pending", "creating", "booked", "complete", "failed"] as const
export type DispatchState = (typeof DISPATCH_STATES)[number]

export const HOLD_MINUTES = 15
export const MAX_ATTEMPTS = 6
export const retryDelayMinutes = (attempts: number) => Math.min(2 ** attempts, 60)

const amount = z.coerce.number()
const amountOrZero = z.preprocess((value) => value ?? 0, z.coerce.number())
export const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  currency_code: z.string(),
  email: z.string().nullish(),
  items: z.array(
    z.object({
      id: z.string(),
      quantity: amount,
      unit_price: amount,
      requires_shipping: z
        .boolean()
        .nullish()
        .transform((value) => value ?? undefined),
      variant: z.object({ weight: z.number().nullish() }).nullish(),
    }),
  ),
  shipping_methods: z.array(z.object({ shipping_option_id: z.string().nullish(), amount })),
  fulfillments: z.array(
    z.object({
      id: z.string(),
      shipping_option_id: z.string().nullish(),
      canceled_at: z.unknown(),
    }),
  ),
  payment_collections: z.array(
    z.object({
      status: z.string(),
      amount,
      captured_amount: amountOrZero,
      refunded_amount: amountOrZero,
    }),
  ),
})
export type DispatchOrder = z.infer<typeof orderSchema>

export type Courier = { kind: "dhl" } | { kind: "nigeria"; carrier: Carrier }
type Option = { id: string; provider_id: string }
export type DispatchPlan<O extends Option> =
  | { action: "skip" }
  | { action: "hold"; reason: string }
  | { action: "fail"; reason: string }
  | {
      action: "fulfill"
      courier: Courier
      option: O
      items: { id: string; quantity: number }[]
      fulfillmentId: string | undefined
      shippingAmount: number
    }

function courierFor(providerId: string): Courier | undefined {
  const carrier = carrierForProvider(providerId)
  if (carrier) return { kind: "nigeria", carrier }
  return providerId === DHL_PROVIDER_ID ? { kind: "dhl" } : undefined
}

export function planDispatch<O extends Option>(
  order: DispatchOrder,
  option: O | undefined,
  { dhlAutoBooking }: { dhlAutoBooking: boolean },
): DispatchPlan<O> {
  const courier = option && courierFor(option.provider_id)
  if (order.status === "canceled" || !option || !courier) return { action: "skip" }
  const [method, ...otherMethods] = order.shipping_methods
  if (!method || otherMethods.length) {
    return { action: "fail", reason: "Automatic dispatch requires one shipping method." }
  }

  const payments = order.payment_collections
  if (payments.some((payment) => payment.refunded_amount > 0)) {
    return { action: "fail", reason: "The order was refunded before dispatch." }
  }
  if (
    !payments.length ||
    payments.some(
      (payment) => payment.status !== "completed" || payment.captured_amount < payment.amount,
    )
  ) {
    return { action: "hold", reason: "Awaiting full payment capture." }
  }
  if (courier.kind === "dhl" && !dhlAutoBooking) {
    return { action: "hold", reason: "DHL_AUTO_BOOKING is disabled." }
  }

  const items = order.items
    .filter((item) => item.requires_shipping !== false)
    .map((item) => ({ id: item.id, quantity: item.quantity }))
  if (!items.length) return { action: "skip" }

  const active = order.fulfillments.filter((fulfillment) => !fulfillment.canceled_at)
  if (active.length > 1 || (active[0] && active[0].shipping_option_id !== option.id)) {
    return { action: "fail", reason: "Existing fulfillment does not match the selected courier." }
  }
  if (!active.length && order.fulfillments.length) {
    return { action: "fail", reason: "Automatic dispatch stopped after fulfillment cancellation." }
  }
  return {
    action: "fulfill",
    courier,
    option,
    items,
    fulfillmentId: active[0]?.id,
    shippingAmount: method.amount,
  }
}
