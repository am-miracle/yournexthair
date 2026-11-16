import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CUSTOM_REQUESTS } from "../../../../modules/custom-requests"
import type CustomRequestsService from "../../../../modules/custom-requests/service"
import { quoteUpdateSchema, referenceOf } from "../../../../modules/custom-requests/submission"

const idOf = (req: MedusaRequest) => req.params.id as string

const serialize = <T extends { number: number }>(request: T) => ({
  ...request,
  reference: referenceOf(request),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: CustomRequestsService = req.scope.resolve(CUSTOM_REQUESTS)
  res.json({ custom_request: serialize(await service.retrieveCustomRequest(idOf(req))) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = quoteUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Check the status and quote details.")
  }
  const service: CustomRequestsService = req.scope.resolve(CUSTOM_REQUESTS)
  res.json({ custom_request: serialize(await service.updateQuote(idOf(req), parsed.data)) })
}
