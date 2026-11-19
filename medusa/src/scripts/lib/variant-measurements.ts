import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Measurement = "weight" | "length" | "width" | "height"

export async function assertVariantMeasurements(
  container: MedusaContainer,
  shippingProfileIds: string[],
  fields: Measurement[],
  instruction: string,
) {
  const variants: { id: string }[] = await container
    .resolve(ContainerRegistrationKeys.PG_CONNECTION)("product_variant as v")
    .join("product as p", "p.id", "v.product_id")
    .join("product_shipping_profile as psp", "psp.product_id", "p.id")
    .whereNull("v.deleted_at")
    .whereNull("p.deleted_at")
    .whereNull("psp.deleted_at")
    .where("p.status", "published")
    .whereIn("psp.shipping_profile_id", shippingProfileIds)
    .where(function missingMeasurements() {
      for (const field of fields) {
        this.orWhereNull(`v.${field}`).orWhere(`v.${field}`, "<=", 0)
      }
    })
    .select("v.id")
  if (variants.length) {
    throw new Error(`${instruction}: ${variants.map((variant) => variant.id).join(", ")}`)
  }
}
