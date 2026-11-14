import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { DHL_OPERATIONS } from "../dhl-operations"
import type DhlOperationsService from "../dhl-operations/service"
import { DhlClient } from "./client"
import { bookDelivery, type Booking } from "./booking"
import { buildQuoteRequest, type ShippingContext } from "./quote"
import { DHL_PROVIDER_ID, dhlEnvironment } from "./config"

const quoteSchema = z.object({
  product_code: z.string().min(1),
  local_product_code: z.string().optional(),
  currency: z.string(),
  amount: z.number().positive(),
})
type Order = {
  id: string
  status: string
  email: string
  currency_code: string
  shipping_address: ShippingContext["shipping_address"]
  items: (NonNullable<ShippingContext["items"]>[number] & { id: string })[]
  shipping_methods: {
    shipping_option_id: string
    amount: number
    data: Record<string, unknown> | null
  }[]
  payment_collections: {
    status: string
    captured_amount: number
    refunded_amount: number
    amount: number
  }[]
}

export async function processDhlBooking(
  container: MedusaContainer,
  orderId: string,
  fulfillmentId: string,
) {
  if (process.env.DHL_AUTO_BOOKING !== "true") {
    return
  }
  const environment = dhlEnvironment()
  const operations: DhlOperationsService = container.resolve(DHL_OPERATIONS)
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const fulfillment = await fulfillmentService.retrieveFulfillment(fulfillmentId, {
    relations: ["items", "delivery_address", "labels"],
  })
  if (fulfillment.provider_id !== DHL_PROVIDER_ID) {
    return
  }
  const client = new DhlClient()
  let [row] = await operations.listBookings(
    { fulfillment_id: fulfillmentId },
    { withDeleted: true },
  )
  if (!row) {
    try {
      row = await operations.createBookings({
        fulfillment_id: fulfillmentId,
        order_id: orderId,
        environment,
        state: "pending",
      })
    } catch (error) {
      ;[row] = await operations.listBookings(
        { fulfillment_id: fulfillmentId },
        { withDeleted: true },
      )
      if (!row) {
        throw error
      }
    }
  }
  const bookingId = row.id
  if (row.deleted_at || row.environment !== environment || row.order_id !== orderId) {
    throw new Error("Booking ledger identity mismatch; reconcile before continuing.")
  }
  const read = async (): Promise<Booking> => {
    const current = await operations.retrieveBooking(bookingId)
    return { state: current.state, shipment_id: current.shipment_id, result: current.result }
  }
  const transition = async (expected: string, next: string, patch: Partial<Booking> = {}) => {
    const count: number = await db("dhl_booking")
      .where({ id: bookingId, state: expected })
      .whereNull("deleted_at")
      .update({ ...patch, state: next, updated_at: new Date(), last_error: null })
    if (count !== 1) {
      throw new Error("Another worker changed this booking. Reconcile before retrying.")
    }
  }
  try {
    if (fulfillment.canceled_at) {
      const current = await read()
      if (current.state === "cancelled") {
        return
      }
      if (!current.shipment_id) {
        if (current.state !== "pending") {
          throw new Error(
            "Shipment creation outcome is unknown. Locate the waybill in DHL before cancellation.",
          )
        }
        await transition(current.state, "cancelled")
        return
      }
      throw new Error(
        "DHL waybills cannot be cancelled through this API. Contact DHL to cancel pickup/resolve charges, then record the outcome manually. No replacement will be booked.",
      )
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = (await query.graph({
      entity: "order",
      fields: [
        "id",
        "status",
        "email",
        "currency_code",
        "shipping_address.*",
        "items.id",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.requires_shipping",
        "items.variant.weight",
        "items.variant.length",
        "items.variant.width",
        "items.variant.height",
        "items.variant.metadata",
        "shipping_methods.shipping_option_id",
        "shipping_methods.amount",
        "shipping_methods.data",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "payment_collections.refunded_amount",
      ],
      filters: { id: orderId },
    })) as unknown as { data: Order[] }
    const order = orders[0]
    if (!order || order.status === "canceled") {
      throw new Error("A live order is required for courier booking.")
    }
    if (
      !order.payment_collections.length ||
      order.payment_collections.some(
        (payment) =>
          payment.status !== "completed" ||
          Number(payment.refunded_amount) > 0 ||
          Number(payment.captured_amount) < Number(payment.amount),
      )
    ) {
      throw new Error("Courier booking is waiting for full payment capture.")
    }
    const method = order.shipping_methods.find(
      (entry) => entry.shipping_option_id === fulfillment.shipping_option_id,
    )
    const quote = quoteSchema.parse(method?.data?.dhl_quote)
    if (quote.currency.toUpperCase() !== order.currency_code.toUpperCase()) {
      throw new Error("The shipping quote currency does not match the order.")
    }
    if (!method || !fulfillment.shipping_option_id) {
      throw new Error("No matching order delivery method.")
    }
    const items = order.items.filter((item) => item.requires_shipping !== false)
    // One tested package per order. Split/multi-parcel fulfillment needs its own packing and budget model.
    if (
      items.length !== fulfillment.items.length ||
      items.some(
        (item) =>
          Number(item.quantity) !==
          Number(fulfillment.items.find((entry) => entry.line_item_id === item.id)?.quantity),
      )
    ) {
      throw new Error("Automatic booking requires the complete shippable order in one fulfillment.")
    }
    const location = await container
      .resolve(Modules.STOCK_LOCATION)
      .retrieveStockLocation(fulfillment.location_id, { relations: ["address"] })
    const option = await fulfillmentService.retrieveShippingOption(fulfillment.shipping_option_id)
    const request = buildQuoteRequest(option.data ?? {}, {
      currency_code: order.currency_code,
      email: order.email,
      from_location: location,
      shipping_address: fulfillment.delivery_address,
      items: items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    })
    const shipment = await bookDelivery({
      store: { read, transition },
      client,
      body: request.body,
      reference: fulfillmentId,
      currency: order.currency_code.toUpperCase(),
      productCode: quote.product_code,
      localProductCode: quote.local_product_code,
      maximumAmount: Math.min(Number(method.amount), quote.amount),
    })
    // Keep labels private: DHL returns base64 documents, not public URLs.
    // Staff download them through the authenticated DHL bookings route.
    const extras = shipment.extras
    const existingLabel = fulfillment.labels.find(
      (label) => label.tracking_number === extras?.tracking_number,
    )
    const trackingUrl = extras?.tracking_url ?? ""
    const labelUrl = extras?.shipping_label ?? ""
    const labelsChanged =
      extras?.tracking_number &&
      (!existingLabel ||
        existingLabel.tracking_url !== trackingUrl ||
        existingLabel.label_url !== labelUrl)
    await fulfillmentService.updateFulfillment(fulfillmentId, {
      data: {
        ...fulfillment.data,
        booking_required: false,
        dhl_shipment_id: shipment.shipment_id,
        dhl_shipment_status: shipment.status,
      },
      ...(labelsChanged
        ? {
            labels: [
              ...fulfillment.labels
                .filter((label) => label.id !== existingLabel?.id)
                .map((label) => ({ id: label.id })),
              {
                ...(existingLabel ? { id: existingLabel.id } : {}),
                tracking_number: extras.tracking_number,
                tracking_url: trackingUrl,
                label_url: labelUrl,
              },
            ],
          }
        : {}),
    })
  } catch (error) {
    // Persist a useful error without DHL response bodies, customer details or credentials.
    await operations.updateBookings({
      id: bookingId,
      last_error: error instanceof Error ? error.message : "Courier booking failed.",
    })
    throw error
  }
}
