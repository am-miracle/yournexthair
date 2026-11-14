import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IFulfillmentModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"
import {
  packagingSchema,
  optionSettingsSchema,
  DHL_PROVIDER_ID,
  dhlCredentials,
  dhlEnvironment,
  optionalDhlCredentials,
} from "../../../modules/dhl-shipping/config"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "data"],
    filters: { provider_id: DHL_PROVIDER_ID, price_type: "calculated" },
  })
  res.json({
    configured: Boolean(optionalDhlCredentials()),
    environment: dhlEnvironment(),
    automatic_booking: process.env.DHL_AUTO_BOOKING === "true",
    shipping_options: options.map((option) => ({
      id: option.id,
      name: option.name,
      settings: optionSettingsSchema.safeParse(option.data?.dhl_shipping).success
        ? option.data?.dhl_shipping
        : null,
    })),
  })
}

const updateSchema = z.object({ shipping_option_id: z.string().min(1), settings: packagingSchema })
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Provide valid package dimensions, weights, and capacity.",
    )
  }
  dhlCredentials()
  const service: IFulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
  const option = await service.retrieveShippingOption(parsed.data.shipping_option_id)
  if (option.provider_id !== DHL_PROVIDER_ID || option.price_type !== "calculated") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Select a calculated DHL shipping option.",
    )
  }
  const saved = { ...parsed.data.settings, environment: dhlEnvironment() }
  optionSettingsSchema.parse(saved)
  await updateShippingOptionsWorkflow(req.scope).run({
    input: [
      {
        id: option.id,
        data: { ...option.data, dhl_shipping: saved },
      },
    ],
  })
  res.json({ settings: saved })
}
