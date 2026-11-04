import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IFulfillmentModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"
import { packagingSchema, optionSettingsSchema, TERMINAL_PROVIDER_ID } from "../../../modules/terminal-shipping/config"
import { TerminalClient } from "../../../modules/terminal-shipping/client"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "data"],
    filters: { provider_id: TERMINAL_PROVIDER_ID, price_type: "calculated" },
  })
  res.json({ configured: Boolean(process.env.TERMINAL_SECRET_KEY), shipping_options: options.map((option) => ({
    id: option.id, name: option.name,
    settings: optionSettingsSchema.safeParse(option.data?.terminal_shipping).success ? option.data?.terminal_shipping : null,
  })) })
}

const updateSchema = z.object({ shipping_option_id: z.string().min(1), settings: packagingSchema })
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Provide valid package dimensions, weights, and capacity.")
  const apiKey = process.env.TERMINAL_SECRET_KEY
  if (!apiKey) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Configure TERMINAL_SECRET_KEY on the backend first.")
  const service: IFulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
  const option = await service.retrieveShippingOption(parsed.data.shipping_option_id)
  if (option.provider_id !== TERMINAL_PROVIDER_ID || option.price_type !== "calculated") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Select a calculated Terminal shipping option.")
  }
  const previous = optionSettingsSchema.safeParse(option.data?.terminal_shipping)
  const settings = parsed.data.settings
  const unchanged = previous.success && JSON.stringify(packagingSchema.parse(previous.data)) === JSON.stringify(settings)
  const packagingId = unchanged && previous.success ? previous.data.packaging_id : await new TerminalClient(apiKey).createPackaging(settings)
  const saved = { ...settings, packaging_id: packagingId }
  await updateShippingOptionsWorkflow(req.scope).run({ input: [{
    id: option.id, data: { ...option.data, terminal_shipping: saved },
  }] })
  res.json({ settings: saved })
}
