import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import type FashionModuleService from "../../../../../modules/fashion/service"
import { FASHION_MODULE } from "../../../../../modules/fashion"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string; colorId: string }

  const fashionModuleService: FashionModuleService = req.scope.resolve(FASHION_MODULE)

  await fashionModuleService.restoreMaterials(id)

  const material = await fashionModuleService.retrieveMaterial(id, {
    relations: ["colors"],
    withDeleted: true,
  })

  res.status(200).json(material)
}
