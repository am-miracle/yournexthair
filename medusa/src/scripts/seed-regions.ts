import { createRegionsWorkflow, updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs, IRegionModuleService, IStoreModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function seedRegions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regions: IRegionModuleService = container.resolve(Modules.REGION)
  const stores: IStoreModuleService = container.resolve(Modules.STORE)
  const nigeriaCountries = ["ng"]
  const usdCountries = [
    "us",
    "ca",
    "au",
    "gb",
    "gh",
    "ke",
    "za",
    "tz",
    "ug",
    "et",
    "eg",
    "ma",
    "jm",
    "tt",
    "bb",
    "gy",
    "bs",
    "in",
    "sg",
    "my",
    "ae",
    "sa",
    "qa",
    "nz",
    "de",
    "fr",
    "es",
    "it",
    "nl",
    "be",
    "se",
    "no",
    "dk",
    "fi",
    "ie",
    "pt",
    "ch",
    "at",
    "pl",
    "cz",
    "hu",
    "hr",
  ]

  const paymentProviders = process.env.BACHS_SECRET_KEY ? ["pp_bachs_bachs"] : ["pp_system_default"]
  const desired = [
    { name: "Nigeria", currency_code: "ngn", countries: nigeriaCountries },
    { name: "International", currency_code: "usd", countries: usdCountries },
  ]
  const existing = await regions.listRegions({}, { relations: ["countries"], take: 1000 })
  const assignedCountries = new Set(
    existing.flatMap((region) => region.countries?.map((country) => country.iso_2) ?? []),
  )
  const missing = desired
    .filter((region) => !existing.some((current) => current.name === region.name))
    .map((region) => ({
      ...region,
      countries: region.countries.filter((country) => !assignedCountries.has(country)),
      payment_providers: paymentProviders,
    }))
    .filter((region) => region.countries.length > 0)

  const created = missing.length
    ? (await createRegionsWorkflow(container).run({ input: { regions: missing } })).result
    : []
  const allRegions = [...existing, ...created]
  const nigeria = allRegions.find((region) =>
    region.countries?.some((country) => country.iso_2 === "ng"),
  )
  const [store] = await stores.listStores({}, { relations: ["supported_currencies"] })
  if (store) {
    const supported = (store.supported_currencies ?? []).map((currency) => ({
      currency_code: currency.currency_code,
      is_default: currency.is_default,
    }))
    for (const code of ["ngn", "usd"]) {
      if (!supported.some((currency) => currency.currency_code === code)) {
        supported.push({ currency_code: code, is_default: supported.length === 0 })
      }
    }
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          supported_currencies: supported,
          ...(!store.default_region_id && nigeria ? { default_region_id: nigeria.id } : {}),
        },
      },
    })
  }
  logger.info(`Created ${created.length} regions; ${allRegions.length} regions now available.`)
}
