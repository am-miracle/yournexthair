import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows"
import { processDhlBooking } from "../dhl-shipping/process-booking"
import { CarrierCache, cachingModuleStore } from "../nigeria-shipping/cache"
import { domesticParcel, NigeriaCarrier, parcelSettings } from "../nigeria-shipping/client"
import { type Carrier, carrierOptions } from "../nigeria-shipping/config"
import { COURIER_DISPATCH } from "."
import { type DispatchOrder, orderSchema, planDispatch } from "./plan"
import type CourierDispatchService from "./service"

type Booking = { fulfillment_id: string; waybill: string; tracking_url: string }
type ShippingOption = { id: string; provider_id: string; data: Record<string, unknown> | null }

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export async function dispatchCourier(container: MedusaContainer, orderId: string) {
  const dispatches: CourierDispatchService = container.resolve(COURIER_DISPATCH)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  await container.resolve(Modules.LOCKING).execute(
    `courier-dispatch:${orderId}`,
    async () => {
      const row = await dispatches.find(orderId)
      if (!row || (row.state !== "pending" && row.state !== "booked")) return
      const fail = async (reason: string) => {
        await dispatches.fail(orderId, reason)
        logger.error(`Courier dispatch for ${orderId} needs review: ${reason}`)
      }
      try {
        if (row.state === "booked") {
          const { fulfillment_id, waybill, tracking_url } = row
          if (!fulfillment_id || !waybill || !tracking_url)
            throw new Error("Missing booked waybill.")
          return await attachWaybill(container, dispatches, orderId, {
            fulfillment_id,
            waybill,
            tracking_url,
          })
        }
        await dispatchPending(container, dispatches, orderId, fail)
      } catch (error) {
        const state = await dispatches.recordError(orderId, errorMessage(error))
        const log = `Courier dispatch for ${orderId} is ${state}: ${errorMessage(error)}`
        if (state === "pending" || state === "booked") logger.warn(log)
        else logger.error(log)
      }
    },
    { timeout: 60 },
  )
}

async function dispatchPending(
  container: MedusaContainer,
  dispatches: CourierDispatchService,
  orderId: string,
  fail: (reason: string) => Promise<void>,
) {
  const order = await retrieveOrder(container, orderId)
  if (!order) return dispatches.transition(orderId, "pending", { state: "complete" })
  const optionId = order.shipping_methods[0]?.shipping_option_id
  const option: ShippingOption | undefined = optionId
    ? await container.resolve(Modules.FULFILLMENT).retrieveShippingOption(optionId)
    : undefined
  const plan = planDispatch(order, option, {
    dhlAutoBooking: process.env.DHL_AUTO_BOOKING === "true",
  })
  if (plan.action === "skip")
    return dispatches.transition(orderId, "pending", { state: "complete" })
  if (plan.action === "hold") return dispatches.hold(orderId, plan.reason)
  if (plan.action === "fail") return fail(plan.reason)

  const fulfillmentId =
    plan.fulfillmentId ??
    (
      await createOrderFulfillmentWorkflow(container).run({
        input: {
          order_id: orderId,
          shipping_option_id: plan.option.id,
          no_notification: true,
          items: plan.items,
        },
      })
    ).result.id
  if (plan.courier.kind === "dhl") {
    // The fulfillment-created subscriber also calls this; the DHL ledger makes the second call a no-op.
    await processDhlBooking(container, orderId, fulfillmentId)
    return dispatches.transition(orderId, "pending", { state: "complete" })
  }
  await bookNigeriaCarrier(container, dispatches, fail, {
    order,
    option: plan.option,
    carrier: plan.courier.carrier,
    fulfillmentId,
    items: plan.items,
    shippingAmount: plan.shippingAmount,
  })
}

async function bookNigeriaCarrier(
  container: MedusaContainer,
  dispatches: CourierDispatchService,
  fail: (reason: string) => Promise<void>,
  {
    order,
    option,
    carrier,
    fulfillmentId,
    items,
    shippingAmount,
  }: {
    order: DispatchOrder
    option: ShippingOption
    carrier: Carrier
    fulfillmentId: string
    items: { id: string; quantity: number }[]
    shippingAmount: number
  },
) {
  const settings = parcelSettings.parse(option.data?.parcel)
  const credentials = carrierOptions(carrier)
  if (!credentials || credentials.live !== option.data?.live) {
    return fail("Configure credentials for this carrier and shipping option environment.")
  }
  const fulfillment = await container
    .resolve(Modules.FULFILLMENT)
    .retrieveFulfillment(fulfillmentId, { relations: ["items", "delivery_address"] })
  const coversParcel =
    !fulfillment.canceled_at &&
    fulfillment.items.length === items.length &&
    items.every((item) =>
      fulfillment.items.some(
        (entry) => entry.line_item_id === item.id && Number(entry.quantity) === item.quantity,
      ),
    )
  if (!coversParcel) {
    return fail("Courier booking requires an active fulfillment for the entire parcel.")
  }

  const location = await container
    .resolve(Modules.STOCK_LOCATION)
    .retrieveStockLocation(fulfillment.location_id, { relations: ["address"] })
  const parcel = domesticParcel(
    { ...order, from_location: location, shipping_address: fulfillment.delivery_address },
    settings.box_weight_grams,
  )
  const cache = new CarrierCache(
    cachingModuleStore(() => container.resolve(Modules.CACHING, { allowUnregistered: true })),
    (message) => container.resolve(ContainerRegistrationKeys.LOGGER).warn(message),
  )
  const quote = await new NigeriaCarrier(credentials, cache).quote(parcel, settings, {
    fresh: true,
  })
  if (!Number.isFinite(shippingAmount) || quote.amount > shippingAmount) {
    return fail(`Carrier price ${quote.amount} exceeds the paid shipping amount ${shippingAmount}.`)
  }

  // A timed-out purchase may have succeeded. Never issue a second purchase automatically.
  await dispatches.transition(order.id, "pending", {
    state: "creating",
    carrier,
    environment: credentials.live ? "live" : "sandbox",
    fulfillment_id: fulfillmentId,
  })
  const { waybill, trackingUrl } = await quote.book(order.id)
  await dispatches.transition(order.id, "creating", {
    state: "booked",
    waybill,
    tracking_url: trackingUrl,
  })
  await attachWaybill(container, dispatches, order.id, {
    fulfillment_id: fulfillmentId,
    waybill,
    tracking_url: trackingUrl,
  })
}

async function attachWaybill(
  container: MedusaContainer,
  dispatches: CourierDispatchService,
  orderId: string,
  { fulfillment_id, waybill, tracking_url }: Booking,
) {
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const fulfillment = await fulfillmentService.retrieveFulfillment(fulfillment_id, {
    relations: ["labels"],
  })
  if (!fulfillment.labels.some((label) => label.tracking_number === waybill)) {
    await fulfillmentService.updateFulfillment(fulfillment.id, {
      data: { ...fulfillment.data, waybill },
      labels: [
        ...fulfillment.labels.map((label) => ({ id: label.id })),
        { tracking_number: waybill, tracking_url, label_url: "" },
      ],
    })
  }
  await dispatches.transition(orderId, "booked", { state: "complete" })
}

async function retrieveOrder(container: MedusaContainer, orderId: string) {
  const {
    data: [order],
  } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "currency_code",
      "email",
      "items.id",
      "items.quantity",
      "items.unit_price",
      "items.requires_shipping",
      "items.variant.weight",
      "shipping_methods.shipping_option_id",
      "shipping_methods.amount",
      "fulfillments.id",
      "fulfillments.shipping_option_id",
      "fulfillments.canceled_at",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.captured_amount",
      "payment_collections.refunded_amount",
    ],
    filters: { id: orderId },
  })
  return order ? orderSchema.parse(order) : undefined
}
