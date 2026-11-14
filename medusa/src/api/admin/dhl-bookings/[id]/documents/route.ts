import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { documentsSchema } from "../../../../../modules/dhl-shipping/documents"
import { DHL_OPERATIONS } from "../../../../../modules/dhl-operations"
import type DhlOperationsService from "../../../../../modules/dhl-operations/service"

/** Admin authentication is inherited from Medusa's /admin routes. Never publish address-bearing labels. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: DhlOperationsService = req.scope.resolve(DHL_OPERATIONS)
  const booking = await service.retrieveBooking(req.params.id!)
  const documents = documentsSchema.safeParse(booking.result?.documents)
  const index = req.query.type === "invoice" ? "invoice" : "label"
  const document = documents.success
    ? documents.data.find(
        (doc) => doc.typeCode === index && doc.imageFormat.toLowerCase() === "pdf",
      )
    : undefined
  if (!document) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No saved PDF is available. Retrieve this document from DHL.",
    )
  }
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="dhl-${index}.pdf"`)
  res.setHeader("Cache-Control", "private, no-store")
  res.send(Buffer.from(document.content, "base64"))
}
