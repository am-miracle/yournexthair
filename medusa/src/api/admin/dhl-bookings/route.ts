import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { DHL_OPERATIONS } from "../../../modules/dhl-operations"
import type DhlOperationsService from "../../../modules/dhl-operations/service"
import { dhlEnvironment } from "../../../modules/dhl-shipping/config"
import { DhlClient } from "../../../modules/dhl-shipping/client"
import { processDhlBooking } from "../../../modules/dhl-shipping/process-booking"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: DhlOperationsService = req.scope.resolve(DHL_OPERATIONS)
  const rows = await service.listBookings({}, { order: { updated_at: "DESC" }, take: 100 })
  res.json({
    bookings: rows.map(
      ({
        id,
        order_id,
        fulfillment_id,
        environment,
        state,
        shipment_id,
        last_error,
        updated_at,
        result,
      }) => ({
        id,
        order_id,
        fulfillment_id,
        environment,
        state,
        shipment_id,
        last_error,
        updated_at,
        has_documents: Array.isArray(result?.documents) && result.documents.length > 0,
      }),
    ),
  })
}

const schema = z.object({
  booking_id: z.string().min(1),
  shipment_id: z.string().min(1).optional(),
})
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "A booking ID is required.")
  }
  const service: DhlOperationsService = req.scope.resolve(DHL_OPERATIONS)
  const booking = await service.retrieveBooking(parsed.data.booking_id)
  if (booking.environment !== dhlEnvironment()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Switch to this booking's DHL environment before reconciliation.",
    )
  }
  if (parsed.data.shipment_id) {
    if (booking.state !== "creating" || booking.shipment_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Only an uncertain shipment creation can be linked to a recovered shipment.",
      )
    }
    const remote = await new DhlClient().getShipment(parsed.data.shipment_id)
    if (
      !remote.references.some(
        (ref) => ref.value === booking.fulfillment_id && ref.typeCode === "CU",
      )
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The shipment does not belong to this Medusa order and fulfillment.",
      )
    }
    const count: number = await req.scope
      .resolve(ContainerRegistrationKeys.PG_CONNECTION)("dhl_booking")
      .where({ id: booking.id, state: "creating" })
      .whereNull("shipment_id")
      .whereNull("deleted_at")
      .update({
        shipment_id: remote.shipment_id,
        state: "booked",
        result: remote,
        updated_at: new Date(),
      })
    if (count !== 1) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "This booking changed during reconciliation. Reload it.",
      )
    }
  }
  await processDhlBooking(req.scope, booking.order_id, booking.fulfillment_id)
  res.json({ booking_id: booking.id })
}
