import { selectRate } from "./quote"
import {
  plannedShippingDate,
  shipmentSchema,
  type DhlClient,
  type DhlShipment,
  type ShipmentBody,
} from "./client"

export type Booking = {
  state: string
  shipment_id: string | null
  result: Record<string, unknown> | null
}
export type BookingStore = {
  read(): Promise<Booking>
  transition(expected: string, next: string, patch?: Partial<Booking>): Promise<void>
}

export async function bookDelivery(input: {
  store: BookingStore
  client: Pick<DhlClient, "getRates" | "createShipment" | "getShipment" | "requestPickup">
  body: ShipmentBody
  reference: string
  currency: string
  productCode: string
  localProductCode?: string | undefined
  maximumAmount: number
}): Promise<DhlShipment & { pickup_error?: string }> {
  const { store, client } = input
  // The waybill stays valid if pickup scheduling fails; only the pickup is retried later.
  const ensurePickup = async (shipment: DhlShipment) => {
    if (shipment.dispatch_confirmation_number) {
      return shipment
    }
    try {
      const updated = {
        ...shipment,
        dispatch_confirmation_number: await client.requestPickup(input.body, input.productCode),
      }
      await store.transition("booked", "booked", { result: updated })
      return updated
    } catch (error) {
      return {
        ...shipment,
        pickup_error: `Waybill ${shipment.shipment_id} is booked, but DHL pickup could not be scheduled (${error instanceof Error ? error.message : "unknown error"}). Retry the booking or schedule collection in MyDHL.`,
      }
    }
  }
  const booking = await store.read()
  if (booking.state === "creating") {
    throw new Error(
      "DHL shipment creation outcome is unknown. Locate the waybill by its fulfillment reference; do not create another shipment.",
    )
  }
  if (booking.state === "cancelled") {
    throw new Error("This booking was cancelled.")
  }
  if (booking.state === "booked" && booking.shipment_id) {
    // A newly created waybill may not be trackable until collection. Its saved successful response is authoritative.
    const saved = shipmentSchema.parse(booking.result)
    if (saved.shipment_id !== booking.shipment_id) {
      throw new Error("DHL booking identity mismatch.")
    }
    let current = saved
    try {
      const remote = await client.getShipment(booking.shipment_id)
      if (remote && remote.status !== saved.status) {
        current = { ...saved, status: remote.status }
        await store.transition("booked", "booked", { result: current })
      }
    } catch {
      /* Newly created labels may not yet be trackable. Preserve the successful booking. */
    }
    return ensurePickup(current)
  }
  if (booking.state !== "pending") {
    throw new Error("This DHL booking needs operator attention.")
  }
  const plannedDate = plannedShippingDate()
  const rate = selectRate(
    await client.getRates(input.body, plannedDate),
    input.currency,
    input.productCode,
    input.localProductCode,
  )
  if (
    !Number.isFinite(input.maximumAmount) ||
    input.maximumAmount <= 0 ||
    rate.amount > input.maximumAmount
  ) {
    throw new Error(
      "The current DHL price exceeds the delivery amount paid. Review the order before booking.",
    )
  }
  await store.transition("pending", "creating")
  const shipment = await client.createShipment(
    input.body,
    rate.product_code,
    input.reference,
    plannedDate,
    rate.local_product_code,
  )
  await store.transition("creating", "booked", {
    shipment_id: shipment.shipment_id,
    result: shipment,
  })
  return ensurePickup(shipment)
}
