import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function fixProductShippingProfiles({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  logger.info("Fetching the shipping profile used by active shipping options...")
  const shippingProfileInUse: Array<{ shipping_profile_id: string }> = await pgConnection(
    "shipping_option as so",
  )
    .whereNull("so.deleted_at")
    .whereNotNull("so.shipping_profile_id")
    .distinct("so.shipping_profile_id")
    .select("so.shipping_profile_id")

  if (shippingProfileInUse.length !== 1) {
    throw new Error(
      `Expected exactly one active shipping profile referenced by shipping options, found ${shippingProfileInUse.length}.`,
    )
  }

  const shippingProfileId = shippingProfileInUse[0]?.shipping_profile_id

  if (!shippingProfileId) {
    throw new Error("Could not resolve the shipping profile used by active shipping options.")
  }

  logger.info("Fetching products...")
  const productsMissingShippingProfile: Array<{ id: string }> = await pgConnection("product as p")
    .leftJoin("product_shipping_profile as psp", function joinShippingProfile() {
      this.on("psp.product_id", "=", "p.id").andOnNull("psp.deleted_at")
    })
    .whereNull("p.deleted_at")
    .where(function whereMissingOrMismatched() {
      this.whereNull("psp.product_id").orWhere("psp.shipping_profile_id", "!=", shippingProfileId)
    })
    .select("p.id")

  logger.info(
    `Found ${productsMissingShippingProfile.length} product(s) missing or mismatched for shipping profile ${shippingProfileId}.`,
  )

  if (!productsMissingShippingProfile.length) {
    logger.info("Nothing to fix.")
    return
  }

  await updateProductsWorkflow(container).run({
    input: {
      products: productsMissingShippingProfile.map((product) => ({
        id: product.id,
        shipping_profile_id: shippingProfileId,
      })),
    },
  })

  logger.info(
    `Linked ${productsMissingShippingProfile.length} product(s) to shipping profile ${shippingProfileId}.`,
  )
}
