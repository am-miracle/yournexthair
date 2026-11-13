import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// Nigeria Tax Act 2025 (in force 1 Jan 2026) retained the 7.5% standard VAT rate.
export const NIGERIA_VAT = { name: "VAT", code: "VAT", rate: 7.5 }

export default async function setupNigeriaVat({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const tax = container.resolve(Modules.TAX)

  let region = (await tax.listTaxRegions({ country_code: "ng" })).find((r) => !r.parent_id)
  if (!region) {
    region = await tax.createTaxRegions({ country_code: "ng", provider_id: "tp_system" })
    logger.info("Created Nigeria tax region.")
  } else if (!region.provider_id) {
    await tax.updateTaxRegions({ id: region.id, provider_id: "tp_system" })
  }

  const existing = (await tax.listTaxRates({ tax_region_id: region.id })).find((r) => r.is_default)
  if (!existing) {
    await tax.createTaxRates({ tax_region_id: region.id, is_default: true, ...NIGERIA_VAT })
    logger.info(`Created Nigeria default VAT rate (${NIGERIA_VAT.rate}%).`)
    return
  }
  if (existing.rate === NIGERIA_VAT.rate && existing.code === NIGERIA_VAT.code) {
    logger.info(`Nigeria VAT already ${NIGERIA_VAT.rate}%. Nothing to do.`)
    return
  }
  await tax.updateTaxRates(existing.id, NIGERIA_VAT)
  logger.info(`Updated Nigeria default VAT rate from ${existing.rate}% to ${NIGERIA_VAT.rate}%.`)
}
