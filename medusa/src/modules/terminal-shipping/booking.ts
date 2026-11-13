import { selectRate } from "./quote"
import type { TerminalClient, TerminalShipment } from "./client"

export type Booking = {
  state: string
  shipment_id: string | null
  result: Record<string, unknown> | null
}
export type BookingStore = {
  read(): Promise<Booking>
  transition(expected: string, next: string, patch?: Partial<Booking>): Promise<void>
}
const bookedStatuses = new Set(["confirmed", "pending", "in-transit", "delivered"])

/** Persist each irreversible boundary before making an upstream request. */
export async function bookDelivery(input: {
  store: BookingStore
  client: Pick<TerminalClient, "createDraft" | "getShipmentRates" | "bookShipment" | "getShipment">
  body: Record<string, unknown>
  currency: string
  carrier: string
  maximumAmount: number
}): Promise<TerminalShipment> {
  const { store, client } = input
  let booking = await store.read()
  if (booking.state === "creating") {
    throw new Error("Draft creation outcome is unknown. Reconcile this booking in Terminal before retrying.")
  }
  if (booking.state === "cancelled") throw new Error("This courier booking was cancelled.")
  if (booking.state === "pending") {
    await store.transition("pending", "creating")
    const shipmentId = await client.createDraft(input.body)
    await store.transition("creating", "draft", { shipment_id: shipmentId })
    booking = await store.read()
  }
  if (!booking.shipment_id) throw new Error("The booking has no saved Terminal shipment ID.")
  if (booking.state === "booking" || booking.state === "booked" || booking.state === "cancelling") {
    const remote = await client.getShipment(booking.shipment_id)
    if (remote.status === "cancelled") {
      await store.transition(booking.state, "cancelled", { result: remote })
      throw new Error("The courier shipment was cancelled in Terminal.")
    }
    if (booking.state === "cancelling" || !bookedStatuses.has(remote.status)) {
      throw new Error("Courier booking outcome is uncertain. Reconcile the saved shipment in Terminal; do not purchase another shipment.")
    }
    await store.transition(booking.state, "booked", { result: remote })
    return remote
  }
  if (booking.state !== "draft") throw new Error("This courier booking needs operator attention.")
  const rate = selectRate(await client.getShipmentRates(booking.shipment_id, input.currency), input.currency, input.carrier)
  if (!rate.rate_id) throw new Error("Terminal returned a non-bookable rate.")
  if (!Number.isFinite(input.maximumAmount) || input.maximumAmount <= 0 || rate.amount > input.maximumAmount) {
    throw new Error("The current courier price exceeds the delivery amount paid. Review the order before booking.")
  }
  await store.transition("draft", "booking")
  const shipment = await client.bookShipment(booking.shipment_id, rate.rate_id)
  if (shipment.shipment_id !== booking.shipment_id || !bookedStatuses.has(shipment.status)) {
    throw new Error("Terminal has not confirmed the saved shipment. Reconcile before retrying.")
  }
  await store.transition("booking", "booked", { result: shipment })
  return shipment
}
