import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { TERMINAL_OPERATIONS } from "../../../modules/terminal-operations"
import type TerminalOperationsService from "../../../modules/terminal-operations/service"
import { TerminalClient } from "../../../modules/terminal-shipping/client"
import { processTerminalBooking } from "../../../modules/terminal-shipping/process-booking"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: TerminalOperationsService = req.scope.resolve(TERMINAL_OPERATIONS)
  const rows = await service.listBookings({}, { order: { updated_at: "DESC" }, take: 100 })
  res.json({ bookings: rows.map(({ id, order_id, fulfillment_id, environment, state, shipment_id, last_error, updated_at }) => ({ id, order_id, fulfillment_id, environment, state, shipment_id, last_error, updated_at })) })
}

const schema = z.object({ booking_id: z.string().min(1), shipment_id: z.string().min(1).optional() })
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A booking ID is required.")
  const service: TerminalOperationsService = req.scope.resolve(TERMINAL_OPERATIONS)
  const booking = await service.retrieveBooking(parsed.data.booking_id)
  if (booking.environment !== (process.env.TERMINAL_ENVIRONMENT ?? "sandbox")) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Switch to this booking's Terminal environment before reconciliation.")
  if (parsed.data.shipment_id) {
    const key = process.env.TERMINAL_SECRET_KEY
    if (!key) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Terminal credentials are missing.")
    if (booking.state !== "creating" || booking.shipment_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only an uncertain draft creation can be linked to a recovered shipment.")
    const remote = await new TerminalClient(key).getShipment(parsed.data.shipment_id)
    if (remote.metadata?.medusa_fulfillment_id !== booking.fulfillment_id || remote.metadata?.medusa_order_id !== booking.order_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "The shipment does not belong to this Medusa order and fulfillment.")
    }
    const count: number = await req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)("terminal_booking")
      .where({ id: booking.id, state: "creating" }).whereNull("shipment_id").whereNull("deleted_at")
      .update({ shipment_id: remote.shipment_id, state: remote.status === "draft" ? "draft" : "booking", updated_at: new Date() })
    if (count !== 1) throw new MedusaError(MedusaError.Types.CONFLICT, "This booking changed during reconciliation. Reload it.")
  }
  await processTerminalBooking(req.scope, booking.order_id, booking.fulfillment_id)
  res.json({ booking: await service.retrieveBooking(booking.id) })
}
