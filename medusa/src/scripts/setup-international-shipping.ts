import type {
  ExecArgs,
  IFulfillmentModuleService,
  IRegionModuleService,
  IStockLocationService,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

const SET_NAME = "International flat-rate shipping"

// Usage: setup-international-shipping <usd-amount> [stock_location_id]
// Shipments are booked by hand with the business's courier; no live quotes.
export default async function setupInternationalShipping({ container, args }: ExecArgs) {
  const amount = Number(args[0])
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Pass the flat USD amount per order, e.g. 40.")
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment: IFulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const regions: IRegionModuleService = container.resolve(Modules.REGION)
  const locations: IStockLocationService = container.resolve(Modules.STOCK_LOCATION)

  const [region, ...extra] = await regions.listRegions(
    { currency_code: "usd" },
    { relations: ["countries"] },
  )
  if (!region?.countries?.length || extra.length)
    throw new Error("Expected exactly one USD region with countries.")
  const all = await locations.listStockLocations({})
  const location = args[1]
    ? all.find((entry) => entry.id === args[1])
    : all.length === 1
      ? all[0]
      : undefined
  if (!location) throw new Error("Pass the dispatch stock_location_id as the second argument.")
  const profiles: Array<{ shipping_profile_id: string }> = await db("product_shipping_profile")
    .whereNull("deleted_at")
    .distinct("shipping_profile_id")
  const channels: Array<{ id: string }> = await db("sales_channel")
    .whereNull("deleted_at")
    .where("is_disabled", false)
    .select("id")
  if (!profiles.length || !channels.length)
    throw new Error("Create products and sales channels before shipping.")

  if (
    !(await db("location_fulfillment_provider")
      .where({ stock_location_id: location.id, fulfillment_provider_id: "manual_manual" })
      .whereNull("deleted_at")
      .first())
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }
  const linked: Array<{ sales_channel_id: string }> = await db("sales_channel_stock_location")
    .where({ stock_location_id: location.id })
    .whereNull("deleted_at")
    .select("sales_channel_id")
  const add = channels
    .map((channel) => channel.id)
    .filter((id) => !linked.some((row) => row.sales_channel_id === id))
  if (add.length)
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add },
    })

  let [set] = await fulfillment.listFulfillmentSets(
    { name: SET_NAME },
    { relations: ["service_zones"] },
  )
  if (!set) {
    set = await fulfillment.createFulfillmentSets({
      name: SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: "International",
          geo_zones: region.countries.map((country) => ({
            type: "country" as const,
            country_code: country.iso_2,
          })),
        },
      ],
    })
  }
  const zone = set.service_zones?.[0]
  if (!zone) throw new Error(`Missing service zone for ${SET_NAME}.`)
  if (
    !(await db("location_fulfillment_set")
      .where({ stock_location_id: location.id, fulfillment_set_id: set.id })
      .whereNull("deleted_at")
      .first())
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
  }

  for (const { shipping_profile_id } of profiles) {
    if (
      await db("shipping_option")
        .where({ service_zone_id: zone.id, shipping_profile_id })
        .whereNull("deleted_at")
        .first()
    ) {
      logger.info(
        `International delivery already exists for ${shipping_profile_id}; change its price in Admin.`,
      )
      continue
    }
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "International delivery",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: zone.id,
          shipping_profile_id,
          type: {
            label: "International delivery",
            code: "international-flat",
            description: "Flat rate per order. Import duties are paid by the customer on delivery.",
          },
          prices: [
            { currency_code: "usd", amount },
            { region_id: region.id, amount },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info(`Created International delivery at USD ${amount} for ${shipping_profile_id}.`)
  }
}
