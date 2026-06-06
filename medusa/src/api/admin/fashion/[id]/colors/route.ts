import { z } from "@medusajs/framework/zod"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import type FashionModuleService from "../../../../../modules/fashion/service"
import { FASHION_MODULE } from "../../../../../modules/fashion"

const colorsListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  deleted: z.coerce.boolean().optional().default(false),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { page, deleted } = colorsListQuerySchema.parse(req.query)

  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)
  const { id } = req.params as { id: string }

  const [colors, count] = await fashionModuleService.listColorsPage(id, page, deleted)

  const last_page = Math.ceil(count / 20)

  res.status(200).json({ colors, count, page, last_page })
}

const colorsCreateBodySchema = z.object({
  name: z.string().min(1),
  hex_code: z.string().min(7).max(7),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string; colorId: string }

  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)

  const body: unknown = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validatedData = colorsCreateBodySchema.parse(body)

  const color = await fashionModuleService.createColor(id, validatedData)

  res.status(200).json(color)
}
