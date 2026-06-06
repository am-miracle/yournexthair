import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"
import type FashionModuleService from "../../../../modules/fashion/service"
import { FASHION_MODULE } from "../../../../modules/fashion"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string; colorId: string }

  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)

  const material = await fashionModuleService.getMaterialDetails(id)

  res.status(200).json(material)
}

const updateMaterialBodySchema = z.object({
  name: z.string().min(1),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string; colorId: string }

  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)

  const body: unknown = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validatedData = updateMaterialBodySchema.parse(body)

  const material = await fashionModuleService.updateMaterial(id, validatedData.name)

  res.status(200).json(material)
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string; colorId: string }

  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)

  await fashionModuleService.deleteMaterial(id)

  const material = await fashionModuleService.getMaterialDetails(id)

  res.status(200).json(material)
}
