import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { ZodError } from "zod"
import { CUSTOM_REQUESTS, CUSTOM_REQUEST_CREATED } from "../../../modules/custom-requests"
import type CustomRequestsService from "../../../modules/custom-requests/service"
import {
  InvalidWhatsappNumber,
  parseSubmission,
  referenceOf,
} from "../../../modules/custom-requests/submission"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as Record<string, unknown>
  if (body.website) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "We couldn't accept this request.")
  }

  let submission
  try {
    submission = parseSubmission(body)
  } catch (error) {
    if (error instanceof InvalidWhatsappNumber) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message)
    }
    if (error instanceof ZodError) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Some details are missing or invalid. Check the form and try again.",
      )
    }
    throw error
  }

  const service: CustomRequestsService = req.scope.resolve(CUSTOM_REQUESTS)
  const { request, created } = await service.submit(submission)

  if (created) {
    // Emitted only after the row is committed, so a notification failure can never lose a request.
    await req.scope
      .resolve(Modules.EVENT_BUS)
      .emit({ name: CUSTOM_REQUEST_CREATED, data: { id: request.id } })
      .catch((error: unknown) =>
        req.scope
          .resolve(ContainerRegistrationKeys.LOGGER)
          .error(
            `Could not queue notifications for custom request ${request.id}`,
            error instanceof Error ? error : undefined,
          ),
      )
  }

  res.status(created ? 201 : 200).json({ custom_request: { reference: referenceOf(request) } })
}
