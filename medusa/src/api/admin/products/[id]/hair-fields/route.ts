import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"
import {
  HAIR_FIELD_DEFS,
  FORM_FIELD_RULES,
  PRODUCT_TYPE_TO_FORM,
  getMissingPublishFields,
} from "../../../../../modules/fashion/hair-fields"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string }
  const productService: IProductModuleService = req.scope.resolve(Modules.PRODUCT)

  const product = await productService.retrieveProduct(id, {
    relations: ["type"],
  })

  const productForm = PRODUCT_TYPE_TO_FORM[product.type?.value ?? ""] ?? null

  if (!productForm) {
    return res.status(200).json({ productForm: null, fields: [], missingRequired: [] })
  }

  const rules = FORM_FIELD_RULES[productForm]
  const metadata: Record<string, unknown> = { ...(product.metadata ?? {}) }

  const fields = Object.entries(rules)
    .filter(([, rule]) => rule !== "hidden")
    .map(([field, rule]) => {
      const def = HAIR_FIELD_DEFS[field]
      return {
        field,
        label: def?.label ?? field,
        type: def?.type ?? "string",
        enumValues: def?.enumValues ?? null,
        rule,
        value: metadata[field] ?? null,
      }
    })

  const missingRequired = getMissingPublishFields(metadata, productForm).map((e) => e.field)

  return res.status(200).json({ productForm, fields, missingRequired })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params as { id: string }
  const productService: IProductModuleService = req.scope.resolve(Modules.PRODUCT)

  const incoming = (req.body ?? {}) as Record<string, unknown>

  const product = await productService.retrieveProduct(id, { relations: ["type"] })
  const currentMetadata: Record<string, unknown> = { ...(product.metadata ?? {}) }

  // Merge only known hair fields; null/empty string removes the key
  for (const field of Object.keys(HAIR_FIELD_DEFS)) {
    if (!(field in incoming)) continue
    const val = incoming[field]
    if (val === null || val === "" || val === undefined) {
      delete currentMetadata[field]
    } else {
      currentMetadata[field] = val
    }
  }

  // Guard: a published product must remain publish-valid after the edit
  if (product.status === "published") {
    const productForm = PRODUCT_TYPE_TO_FORM[product.type?.value ?? ""]
    if (productForm) {
      const missing = getMissingPublishFields(currentMetadata, productForm)
      if (missing.length > 0) {
        return res.status(422).json({
          message: `Cannot remove required fields from a published product — ${missing.map((f) => f.label).join(", ")}`,
        })
      }
    }
  }

  await productService.updateProducts(id, { metadata: currentMetadata })

  return res.status(200).json({ ok: true })
}
