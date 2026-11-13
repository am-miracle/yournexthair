import type { ExecArgs, IFulfillmentModuleService, IRegionModuleService, IStockLocationService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow, createStockLocationsWorkflow, linkSalesChannelsToStockLocationWorkflow } from "@medusajs/medusa/core-flows"

/** Sample rates only. Never run this against a store accepting real orders. */
export default async function seedDevShipping({ container }: ExecArgs) {
  if (process.env.APP_ENV !== "development") {
    throw new Error("Sample shipping is restricted to APP_ENV=development.")
  }
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const locations: IStockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const fulfillment: IFulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const regions: IRegionModuleService = container.resolve(Modules.REGION)
  const profiles: Array<{ shipping_profile_id: string }> = await db("product_shipping_profile").whereNull("deleted_at").distinct("shipping_profile_id")
  const channels = await db("sales_channel").whereNull("deleted_at").where("is_disabled", false).select("id")
  const destinations = await regions.listRegions({}, { relations: ["countries"], take: 1000 })
  if (!profiles.length || !channels.length || !destinations.length) {
    throw new Error("Seed the catalog, sales channels and regions before shipping.")
  }
  if (destinations.some((region) => !["ngn", "usd"].includes(region.currency_code))) {
    throw new Error("Sample rates are only defined for NGN and USD regions.")
  }
  const locationName = "Development test warehouse"
  let [location] = await locations.listStockLocations({ name: locationName })
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: { locations: [{ name: locationName, address: { country_code: "ng", city: "Port Harcourt", address_1: "Development fixture — not a dispatch address" } }] },
    })
    location = result[0]
  }
  if (!location) throw new Error("Could not create the development warehouse.")
  const locationId = location.id
  if (!await db("location_fulfillment_provider").where({ stock_location_id: locationId, fulfillment_provider_id: "manual_manual" }).whereNull("deleted_at").first()) {
    await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: locationId }, [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" } })
  }
  const existingChannels = await db("sales_channel_stock_location").where({ stock_location_id: locationId }).whereNull("deleted_at").select("sales_channel_id")
  const add = channels.map((channel: { id: string }) => channel.id).filter((id: string) => !existingChannels.some((row: { sales_channel_id: string }) => row.sales_channel_id === id))
  if (add.length) await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: locationId, add } })

  for (const region of destinations) {
    if (!region.countries?.length) continue
    const name = `Development test delivery — ${region.id}`
    let [set] = await fulfillment.listFulfillmentSets({ name }, { relations: ["service_zones"] })
    if (!set) {
      set = await fulfillment.createFulfillmentSets({ name, type: "shipping", service_zones: [{ name: `Test delivery: ${region.name}`, geo_zones: region.countries.map((country) => ({ type: "country" as const, country_code: country.iso_2 })) }] })
    }
    const zone = set.service_zones?.[0]
    if (!zone) throw new Error(`Missing service zone for ${name}.`)
    if (!await db("location_fulfillment_set").where({ stock_location_id: locationId, fulfillment_set_id: set.id }).whereNull("deleted_at").first()) {
      await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: locationId }, [Modules.FULFILLMENT]: { fulfillment_set_id: set.id } })
    }
    for (const profile of profiles) {
      const existing = await db("shipping_option").where({ service_zone_id: zone.id, shipping_profile_id: profile.shipping_profile_id }).whereNull("deleted_at")
      if (existing.length) continue
      const amount = region.currency_code === "ngn" ? 15000 : 10
      await createShippingOptionsWorkflow(container).run({ input: [{
        name: "Test delivery (sample rate)", price_type: "flat", provider_id: "manual_manual",
        service_zone_id: zone.id, shipping_profile_id: profile.shipping_profile_id,
        type: { label: "Test delivery", code: "development-test", description: "Development only. Sample rate; no courier booking or delivery promise." },
        prices: [{ currency_code: region.currency_code, amount }, { region_id: region.id, amount }],
        rules: [{ attribute: "enabled_in_store", value: "true", operator: "eq" }, { attribute: "is_return", value: "false", operator: "eq" }],
      }] })
    }
  }
  logger.info("Development shipping ready: sample NGN 15,000 / USD 10 delivery. No inventory quantities or live courier configuration changed.")
}
