import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"
import {
  getMissingPublishFields,
  PRODUCT_TYPE_TO_FORM,
} from "../../../modules/fashion/hair-fields"

type NextFn = (error?: unknown) => void

export async function validatePublishHairFields(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: NextFn
): Promise<void> {
  const body = req.body as Record<string, unknown> | undefined

  // Only intercept requests that are trying to publish
  if (body?.status !== "published") {
    return next()
  }

  const { id } = req.params as { id: string }
  const productService: IProductModuleService = req.scope.resolve(Modules.PRODUCT)

  const product = await productService
    .retrieveProduct(id, { relations: ["type"] })
    .catch(() => null)

  if (!product) return next()

  const productForm = PRODUCT_TYPE_TO_FORM[product.type?.value ?? ""]
  if (!productForm) return next()

  // Merge incoming metadata with current so a same-request metadata + publish works
  const currentMeta = (product.metadata ?? {}) as Record<string, unknown>
  const incomingMeta =
    typeof body.metadata === "object" && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : {}
  const effectiveMeta = { ...currentMeta, ...incomingMeta }

  const missing = getMissingPublishFields(effectiveMeta, productForm)
  if (missing.length === 0) return next()

  next(
    new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Cannot publish: missing required hair fields for ${productForm} — ${missing.map((f) => f.label).join(", ")}`
    )
  )
}
