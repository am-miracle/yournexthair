import { readFile } from "node:fs/promises"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "zod"
import {
  packagingSchema,
  optionSettingsSchema,
  DHL_PROVIDER_ID,
  dhlCredentials,
  dhlEnvironment,
} from "../modules/dhl-shipping/config"

const schema = z.object({
  stock_location_id: z.string().min(1),
  sales_channel_ids: z.array(z.string().min(1)).min(1),
  shipping_profile_ids: z.array(z.string().min(1)).min(1),
  countries: z.array(z.string().regex(/^[a-z]{2}$/)).min(1),
  package: packagingSchema,
})

export default async function setupDhlShipping({ container, args }: ExecArgs) {
  if (!args[0]) {
    throw new Error("Pass a JSON configuration file. See the DHL shipping README.")
  }
  const config = schema.parse(JSON.parse(await readFile(args[0], "utf8")))
  dhlCredentials()
  const environment = dhlEnvironment()
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const location = await container
    .resolve(Modules.STOCK_LOCATION)
    .retrieveStockLocation(config.stock_location_id, { relations: ["address"] })
  if (
    !location.address?.address_1?.trim() ||
    !location.address.city?.trim() ||
    !location.address.province?.trim() ||
    !location.address.postal_code?.trim() ||
    !location.address.phone?.trim()
  ) {
    throw new Error(
      "Enter the real dispatch street, city, state, postal code and phone in the stock location first.",
    )
  }
  // Validate every referenced resource and all published variants before making any changes.
  for (const id of config.sales_channel_ids) {
    await container.resolve(Modules.SALES_CHANNEL).retrieveSalesChannel(id)
  }
  for (const id of config.shipping_profile_ids) {
    await fulfillment.retrieveShippingProfile(id)
  }
  const countries = new Set(
    (
      await container
        .resolve(Modules.REGION)
        .listRegions({}, { relations: ["countries"], take: 1000 })
    ).flatMap((region) => region.countries?.map((country) => country.iso_2) ?? []),
  )
  if (config.countries.some((country) => !countries.has(country))) {
    throw new Error("Each delivery country must belong to an existing store region.")
  }
  const variants: Array<{ id: string }> = await db("product_variant as v")
    .join("product as p", "p.id", "v.product_id")
    .join("product_shipping_profile as psp", "psp.product_id", "p.id")
    .whereNull("v.deleted_at")
    .whereNull("p.deleted_at")
    .whereNull("psp.deleted_at")
    .where("p.status", "published")
    .whereIn("psp.shipping_profile_id", config.shipping_profile_ids)
    .where(function missingMeasurements() {
      for (const field of ["weight", "length", "width", "height"]) {
        this.orWhereNull(`v.${field}`).orWhere(`v.${field}`, "<=", 0)
      }
    })
    .select("v.id")
  if (variants.length) {
    throw new Error(
      `Set real gram weights and packed centimetre dimensions for variants: ${variants.map((variant) => variant.id).join(", ")}`,
    )
  }

  if (
    !(await db("location_fulfillment_provider")
      .where({ stock_location_id: location.id, fulfillment_provider_id: DHL_PROVIDER_ID })
      .whereNull("deleted_at")
      .first())
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: DHL_PROVIDER_ID },
    })
  }
  const channels: Array<{ sales_channel_id: string }> = await db("sales_channel_stock_location")
    .where({ stock_location_id: location.id })
    .whereNull("deleted_at")
    .select("sales_channel_id")
  const add = config.sales_channel_ids.filter(
    (id) => !channels.some((row) => row.sales_channel_id === id),
  )
  if (add.length) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add },
    })
  }
  for (const country of new Set(config.countries)) {
    const name = `DHL ${environment} — ${location.id} — ${country}`
    let [set] = await fulfillment.listFulfillmentSets({ name }, { relations: ["service_zones"] })
    if (!set) {
      set = await fulfillment.createFulfillmentSets({
        name,
        type: "shipping",
        service_zones: [
          {
            name: `Courier delivery: ${country.toUpperCase()}`,
            geo_zones: [{ type: "country", country_code: country }],
          },
        ],
      })
    }
    const zone = set.service_zones?.[0]
    if (!zone) {
      throw new Error(`Missing service zone for ${name}.`)
    }
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
    for (const profileId of new Set(config.shipping_profile_ids)) {
      const existing: Array<{ id: string; data: Record<string, unknown> | null }> = await db(
        "shipping_option",
      )
        .where({
          service_zone_id: zone.id,
          shipping_profile_id: profileId,
          provider_id: DHL_PROVIDER_ID,
        })
        .whereNull("deleted_at")
        .select("id", "data")
      const option = existing[0]
      if (option) {
        const saved = optionSettingsSchema.safeParse(option.data?.dhl_shipping)
        if (
          !saved.success ||
          saved.data.environment !== environment ||
          JSON.stringify(packagingSchema.parse(saved.data)) !== JSON.stringify(config.package)
        ) {
          throw new Error(
            `Existing option ${option.id} has different settings. Review and update its package in Admin; setup does not overwrite delivery configuration.`,
          )
        }
        continue
      }
      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: "Courier delivery",
            provider_id: DHL_PROVIDER_ID,
            price_type: "calculated",
            service_zone_id: zone.id,
            shipping_profile_id: profileId,
            type: {
              label: "Courier delivery",
              code: "dhl-courier",
              description: "Live courier pickup and delivery.",
            },
            data: { id: "dhl-pickup", dhl_shipping: { ...config.package, environment } },
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          },
        ],
      })
    }
  }
  container
    .resolve("logger")
    .info(
      `DHL ${environment} shipping configured for ${config.countries.join(", ")}. Verify a checkout quote, sandbox booking and cancellation before enabling live automatic booking.`,
    )
}
