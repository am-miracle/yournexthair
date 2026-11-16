import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CUSTOM_REQUESTS } from "../../../modules/custom-requests"
import type CustomRequestsService from "../../../modules/custom-requests/service"
import { CUSTOM_REQUEST_STATUSES, referenceOf } from "../../../modules/custom-requests/submission"

const PAGE_SIZE = 50

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: CustomRequestsService = req.scope.resolve(CUSTOM_REQUESTS)
  const status = CUSTOM_REQUEST_STATUSES.find((value) => value === req.query.status)
  const offset = Math.max(0, Number(req.query.offset) || 0)

  const [rows, count] = await service.listAndCountCustomRequests(status ? { status } : {}, {
    order: { created_at: "DESC" },
    skip: offset,
    take: PAGE_SIZE,
    select: ["id", "number", "status", "name", "country_code", "city", "hair_type", "created_at"],
  })

  res.json({
    custom_requests: rows.map((row) => ({ ...row, reference: referenceOf(row) })),
    count,
    offset,
    limit: PAGE_SIZE,
  })
}
