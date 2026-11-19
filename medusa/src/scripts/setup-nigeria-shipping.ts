import { readFile } from "node:fs/promises"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "zod"
import { parcelSettings } from "../modules/nigeria-shipping/client"
import { carrierIds, carrierNames, carrierOptions } from "../modules/nigeria-shipping/config"
import { assertVariantMeasurements } from "./lib/variant-measurements"

const schema = z.object({
  stock_location_id: z.string().min(1),
  sales_channel_ids: z.array(z.string().min(1)).min(1),
  shipping_profile_ids: z.array(z.string().min(1)).min(1),
  parcel: parcelSettings,
  zones: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        provinces: z.array(z.string().trim().toLowerCase().min(1)).min(1),
        carriers: z.array(z.enum(["fez", "gig"])).min(1),
      }),
    )
    .min(1),
})

export default async function setupNigeriaShipping({ container, args }: ExecArgs) {
  if (!args[0]) throw new Error("Pass the path to the Nigeria shipping configuration JSON.")
  const config = schema.parse(JSON.parse(await readFile(args[0], "utf8")))
  const carriers = [...new Set(config.zones.flatMap((zone) => zone.carriers))].map((carrier) => {
    const options = carrierOptions(carrier)
    if (!options) throw new Error(`Configure ${carrierNames[carrier]} credentials first.`)
    return { carrier, id: carrierIds[carrier], live: options.live }
  })
  const names = config.zones.map((zone) => zone.name)
  const provinces = config.zones.flatMap((zone) => zone.provinces)
  if (new Set(names).size !== names.length || new Set(provinces).size !== provinces.length) {
    throw new Error("Use unique zone names and assign each Nigerian state to one zone.")
  }

  const [region] = await container
    .resolve(Modules.REGION)
    .listRegions({ currency_code: "ngn" }, { relations: ["countries"], take: 1000 })
    .then((regions) =>
      regions.filter((entry) => entry.countries?.some((country) => country.iso_2 === "ng")),
    )
  if (!region) throw new Error("Configure a Nigeria region with NGN first.")

  const location = await container
    .resolve(Modules.STOCK_LOCATION)
    .retrieveStockLocation(config.stock_location_id, { relations: ["address"] })
  if (location.address?.country_code?.toLowerCase() !== "ng") {
    throw new Error("Use a Nigerian dispatch stock location.")
  }

  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const salesChannels = container.resolve(Modules.SALES_CHANNEL)
  for (const id of new Set(config.shipping_profile_ids))
    await fulfillment.retrieveShippingProfile(id)
  for (const id of new Set(config.sales_channel_ids)) await salesChannels.retrieveSalesChannel(id)
  await assertVariantMeasurements(
    container,
    config.shipping_profile_ids,
    ["weight"],
    "Set measured gram weights for variants",
  )

  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const name = `Nigeria delivery — ${location.id}`
  let [set] = await fulfillment.listFulfillmentSets(
    { name },
    { relations: ["service_zones", "service_zones.geo_zones"] },
  )
  if (set) {
    const saved = set.service_zones ?? []
    if (
      saved.length !== config.zones.length ||
      config.zones.some((zone) => {
        const existing = saved.find((entry) => entry.name === zone.name)?.geo_zones ?? []
        return (
          existing.length !== zone.provinces.length ||
          existing.some(
            (geo) =>
              geo.type !== "province" ||
              geo.country_code !== "ng" ||
              !geo.province_code ||
              !zone.provinces.includes(geo.province_code),
          )
        )
      })
    ) {
      throw new Error(
        "The saved delivery zones differ from the configuration. Review them in Admin.",
      )
    }
  }

  for (const { id } of carriers) {
    if (
      !(await db("location_fulfillment_provider")
        .where({ stock_location_id: location.id, fulfillment_provider_id: id })
        .whereNull("deleted_at")
        .first())
    ) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: id },
      })
    }
  }

  const linked: { sales_channel_id: string }[] = await db("sales_channel_stock_location")
    .where({ stock_location_id: location.id })
    .whereNull("deleted_at")
    .select("sales_channel_id")
  const add = [...new Set(config.sales_channel_ids)].filter(
    (id) => !linked.some((entry) => entry.sales_channel_id === id),
  )
  if (add.length) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add },
    })
  }

  set ??= await fulfillment.createFulfillmentSets({
    name,
    type: "shipping",
    service_zones: config.zones.map((zone) => ({
      name: zone.name,
      geo_zones: zone.provinces.map((province_code) => ({
        type: "province" as const,
        country_code: "ng",
        province_code,
      })),
    })),
  })
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

  for (const configuredZone of config.zones) {
    const zone = set.service_zones?.find((entry) => entry.name === configuredZone.name)
    if (!zone) throw new Error(`Missing service zone for ${configuredZone.name}.`)
    for (const { carrier, id, live } of carriers.filter((entry) =>
      configuredZone.carriers.includes(entry.carrier),
    )) {
      for (const shippingProfileId of new Set(config.shipping_profile_ids)) {
        const existing: { id: string; data: Record<string, unknown> | null }[] = await db(
          "shipping_option",
        )
          .where({
            service_zone_id: zone.id,
            shipping_profile_id: shippingProfileId,
            provider_id: id,
          })
          .whereNull("deleted_at")
          .select("id", "data")
        const option = existing[0]
        const data = { id: carrier, parcel: config.parcel, live }
        if (option) {
          const saved = parcelSettings.safeParse(option.data?.parcel)
          const unchanged =
            saved.success &&
            option.data?.live === live &&
            Object.entries(config.parcel).every(
              ([key, value]) => saved.data[key as keyof typeof saved.data] === value,
            )
          if (!unchanged) {
            await fulfillment.updateShippingOptions(option.id, {
              data: { ...option.data, ...data },
            })
            logger.info(
              `Updated ${carrierNames[carrier]} option ${option.id} to the configured parcel and ${live ? "live" : "sandbox"} environment.`,
            )
          }
          continue
        }
        await createShippingOptionsWorkflow(container).run({
          input: [
            {
              name: carrierNames[carrier],
              price_type: "calculated",
              provider_id: id,
              service_zone_id: zone.id,
              shipping_profile_id: shippingProfileId,
              type: {
                label: carrierNames[carrier],
                code: `nigeria-${carrier}`,
                description: "Door-to-door delivery within Nigeria.",
              },
              data,
              rules: [
                { attribute: "enabled_in_store", value: "true", operator: "eq" },
                { attribute: "is_return", value: "false", operator: "eq" },
              ],
            },
          ],
        })
        logger.info(`Enabled ${carrierNames[carrier]} for ${zone.name} and ${shippingProfileId}.`)
      }
    }
  }
}
