import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function fixTaxRegions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)

  logger.info("Fetching all tax regions...")
  const taxRegions = await taxModuleService.listTaxRegions({})

  const nullProviderRegions = taxRegions.filter((r) => !r.provider_id)
  logger.info(`Found ${nullProviderRegions.length} tax regions with no provider.`)

  if (!nullProviderRegions.length) {
    logger.info("All tax regions already have a provider. Nothing to fix.")
    return
  }

  await taxModuleService.updateTaxRegions(
    nullProviderRegions.map((r) => ({
      id: r.id,
      provider_id: "tp_system",
    }))
  )

  logger.info(`Updated ${nullProviderRegions.length} tax regions to use the system provider.`)
}
