import type { MedusaContainer } from "@medusajs/framework/types"
import { TERMINAL_OPERATIONS } from "../modules/terminal-operations"
import type TerminalOperationsService from "../modules/terminal-operations/service"
import { processTerminalBooking } from "../modules/terminal-shipping/process-booking"

export default async function reconcileTerminalBookings(container: MedusaContainer) {
  if (process.env.TERMINAL_AUTO_BOOKING !== "true") return
  const operations: TerminalOperationsService = container.resolve(TERMINAL_OPERATIONS)
  // Oldest checked records first, so persistent failures cannot starve newer orders.
  const bookings = await operations.listBookings({ state: { $ne: "cancelled" } }, { order: { updated_at: "ASC" }, take: 100 })
  for (const booking of bookings) {
    try { await processTerminalBooking(container, booking.order_id, booking.fulfillment_id) }
    catch { container.resolve("logger").warn(`Terminal booking ${booking.id} needs retry or reconciliation; see Terminal shipping in Admin.`) }
  }
}
export const config = { name: "terminal-bookings", schedule: "*/5 * * * *" }
