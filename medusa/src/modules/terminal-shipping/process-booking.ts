import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { TERMINAL_OPERATIONS } from "../terminal-operations"
import type TerminalOperationsService from "../terminal-operations/service"
import { TerminalClient, terminalApiUrl } from "./client"
import { bookDelivery, type Booking } from "./booking"
import { buildQuoteRequest, type ShippingContext } from "./quote"
import { TERMINAL_PROVIDER_ID } from "./config"

const quoteSchema = z.object({ carrier_reference: z.string().min(1), currency: z.string(), amount: z.number().positive() })
type Order = {
  id: string; status: string; email: string; currency_code: string
  shipping_address: ShippingContext["shipping_address"]
  items: (NonNullable<ShippingContext["items"]>[number] & { id: string })[]
  shipping_methods: { shipping_option_id: string; amount: number; data: Record<string, unknown> | null }[]
  payment_collections: { status: string; captured_amount: number; refunded_amount: number; amount: number }[]
}

/** Called after Medusa commits the order fulfillment, never while browsing checkout. */
export async function processTerminalBooking(container: MedusaContainer, orderId: string, fulfillmentId: string) {
  if (process.env.TERMINAL_AUTO_BOOKING !== "true") return
  const apiKey = process.env.TERMINAL_SECRET_KEY
  if (!apiKey) throw new Error("Terminal automatic booking requires TERMINAL_SECRET_KEY.")
  const environment = process.env.TERMINAL_ENVIRONMENT ?? "sandbox"
  const client = new TerminalClient(apiKey, terminalApiUrl(environment))
  const operations: TerminalOperationsService = container.resolve(TERMINAL_OPERATIONS)
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const fulfillment = await fulfillmentService.retrieveFulfillment(fulfillmentId, { relations: ["items", "delivery_address", "labels"] })
  if (fulfillment.provider_id !== TERMINAL_PROVIDER_ID) return
  let [row] = await operations.listBookings({ fulfillment_id: fulfillmentId }, { withDeleted: true })
  if (!row) {
    try {
      row = await operations.createBookings({ fulfillment_id: fulfillmentId, order_id: orderId, environment, state: "pending" })
    } catch (error) {
      ;[row] = await operations.listBookings({ fulfillment_id: fulfillmentId }, { withDeleted: true })
      if (!row) throw error
    }
  }
  const bookingId = row.id
  if (row.deleted_at || row.environment !== environment || row.order_id !== orderId) throw new Error("Booking ledger identity mismatch; reconcile before continuing.")
  const read = async (): Promise<Booking> => {
    const current = await operations.retrieveBooking(bookingId)
    return { state: current.state, shipment_id: current.shipment_id, result: current.result }
  }
  const transition = async (expected: string, next: string, patch: Partial<Booking> = {}) => {
    const count: number = await db("terminal_booking").where({ id: bookingId, state: expected }).whereNull("deleted_at")
      .update({ ...patch, state: next, updated_at: new Date(), last_error: null })
    if (count !== 1) throw new Error("Another worker changed this booking. Reconcile before retrying.")
  }
  try {
    if (fulfillment.canceled_at) {
      const current = await read()
      if (current.state === "cancelled") return
      if (!current.shipment_id) {
        if (current.state !== "pending") throw new Error("Draft creation outcome is unknown. Locate the shipment in Terminal before cancellation.")
        await transition(current.state, "cancelled")
        return
      }
      const remote = await client.getShipment(current.shipment_id)
      if (remote.status !== "cancelled") {
        // Cancellation may be repeated against the SAME ID; it can never create a new paid shipment.
        if (current.state !== "cancelling") await transition(current.state, "cancelling")
        await client.cancelShipment(current.shipment_id)
        const confirmed = await client.getShipment(current.shipment_id)
        if (confirmed.status !== "cancelled") throw new Error("Terminal has not confirmed cancellation. Operator attention required.")
      }
      await transition((await read()).state, "cancelled")
      return
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({ entity: "order", fields: [
      "id", "status", "email", "currency_code", "shipping_address.*",
      "items.id", "items.title", "items.quantity", "items.unit_price", "items.requires_shipping", "items.variant.weight", "items.variant.length", "items.variant.width", "items.variant.height", "items.variant.metadata",
      "shipping_methods.shipping_option_id", "shipping_methods.amount", "shipping_methods.data", "payment_collections.status", "payment_collections.amount", "payment_collections.captured_amount", "payment_collections.refunded_amount",
    ], filters: { id: orderId } }) as unknown as { data: Order[] }
    const order = orders[0]
    if (!order || order.status === "canceled") throw new Error("A live order is required for courier booking.")
    if (!order.payment_collections.length || order.payment_collections.some((payment) => payment.status !== "completed" || Number(payment.refunded_amount) > 0 || Number(payment.captured_amount) < Number(payment.amount))) {
      throw new Error("Courier booking is waiting for full payment capture.")
    }
    const method = order.shipping_methods.find((entry) => entry.shipping_option_id === fulfillment.shipping_option_id)
    const quote = quoteSchema.parse(method?.data?.terminal_quote)
    if (quote.currency.toUpperCase() !== order.currency_code.toUpperCase()) throw new Error("The shipping quote currency does not match the order.")
    if (!method || !fulfillment.shipping_option_id) throw new Error("No matching order delivery method.")
    const items = order.items.filter((item) => item.requires_shipping !== false)
    // One tested package per order. Split/multi-parcel fulfillment needs its own packing and budget model.
    if (items.length !== fulfillment.items.length || items.some((item) => Number(item.quantity) !== Number(fulfillment.items.find((entry) => entry.line_item_id === item.id)?.quantity))) {
      throw new Error("Automatic booking requires the complete shippable order in one fulfillment.")
    }
    const location = await container.resolve(Modules.STOCK_LOCATION).retrieveStockLocation(fulfillment.location_id, { relations: ["address"] })
    const option = await fulfillmentService.retrieveShippingOption(fulfillment.shipping_option_id)
    const request = buildQuoteRequest(option.data ?? {}, {
      currency_code: order.currency_code, email: order.email,
      from_location: location, shipping_address: fulfillment.delivery_address,
      items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
    })
    for (const address of [request.body.pickup_address, request.body.delivery_address]) {
      if (!address.first_name.trim() || !address.last_name.trim() || !address.phone.trim() || !address.zip.trim()) {
        throw new Error("Courier booking needs pickup and delivery contact names, phone numbers and postal codes.")
      }
    }
    const shipment = await bookDelivery({
      store: { read, transition }, client,
      body: { pickup_address: request.body.pickup_address, delivery_address: request.body.delivery_address, parcel: request.body.parcel, shipment_purpose: "commercial", metadata: { medusa_order_id: orderId, medusa_fulfillment_id: fulfillmentId } },
      currency: order.currency_code.toUpperCase(), carrier: quote.carrier_reference,
      maximumAmount: Math.min(Number(method.amount), quote.amount),
    })
    const extras = shipment.extras
    const existingLabel = fulfillment.labels.find((label) => label.tracking_number === extras?.tracking_number)
    const trackingUrl = extras?.tracking_url ?? extras?.carrier_tracking_url ?? ""
    const labelUrl = extras?.shipping_label ?? ""
    const labelsChanged = extras?.tracking_number && (!existingLabel || existingLabel.tracking_url !== trackingUrl || existingLabel.label_url !== labelUrl)
    await fulfillmentService.updateFulfillment(fulfillmentId, {
      data: { ...fulfillment.data, booking_required: false, terminal_shipment_id: shipment.shipment_id, terminal_shipment_status: shipment.status },
      ...(labelsChanged ? { labels: [...fulfillment.labels.filter((label) => label.id !== existingLabel?.id).map((label) => ({ id: label.id })), {
        ...(existingLabel ? { id: existingLabel.id } : {}), tracking_number: extras.tracking_number!, tracking_url: trackingUrl, label_url: labelUrl,
      }] } : {}),
    })
  } catch (error) {
    // Persist a useful error without Terminal response bodies, customer details or credentials.
    await operations.updateBookings({ id: bookingId, last_error: error instanceof Error ? error.message : "Courier booking failed." })
    throw error
  }
}
