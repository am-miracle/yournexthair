import type { MedusaContainer } from "@medusajs/framework/types"
import { DHL_OPERATIONS } from "../modules/dhl-operations"
import type DhlOperationsService from "../modules/dhl-operations/service"
import { processDhlBooking } from "../modules/dhl-shipping/process-booking"

export default async function reconcileDhlBookings(container: MedusaContainer) {
  if (process.env.DHL_AUTO_BOOKING !== "true") {
    return
  }
  const operations: DhlOperationsService = container.resolve(DHL_OPERATIONS)
  // Oldest checked records first, so persistent failures cannot starve newer orders.
  const bookings = await operations.listBookings(
    { state: { $ne: "cancelled" } },
    { order: { updated_at: "ASC" }, take: 100 },
  )
  for (const booking of bookings) {
    try {
      await processDhlBooking(container, booking.order_id, booking.fulfillment_id)
    } catch {
      container
        .resolve("logger")
        .warn(`Dhl booking ${booking.id} needs retry or reconciliation; see Dhl shipping in Admin.`)
    }
  }
}
export const config = { name: "dhl-bookings", schedule: "*/5 * * * *" }
