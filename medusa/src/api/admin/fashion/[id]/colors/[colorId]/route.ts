import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"
import type FashionModuleService from "../../../../../../modules/fashion/service"
import { FASHION_MODULE } from "../../../../../../modules/fashion"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)

  const { id, colorId } = req.params as { id: string; colorId: string }

  const color = await fashionModuleService.getColorForMaterial(id, colorId)

  res.status(200).json(color)
}

const colorsUpdateBodySchema = z.object({
  name: z.string().min(1),
  hex_code: z
    .string()
    .min(1)
    .transform((val) => val.toUpperCase())
    .refine((val) => /^#([A-F0-9]{6}|[A-F0-9]{3})$/.test(val), {
      message: "Invalid hex code",
    }),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)
  const { id, colorId } = req.params as { id: string; colorId: string }

  const body: unknown = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validatedData = colorsUpdateBodySchema.parse(body)

  const color = await fashionModuleService.updateColorForMaterial(id, colorId, validatedData)

  res.status(200).json(color)
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)
  const { id, colorId } = req.params as { id: string; colorId: string }

  const color = await fashionModuleService.deleteColorForMaterial(id, colorId)

  res.status(200).json(color)
}
