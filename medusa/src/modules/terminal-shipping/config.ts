import { z } from "zod"

export const TERMINAL_PROVIDER_ID = "terminal_terminal"
export const packagingSchema = z.object({
  name: z.string().trim().min(1).max(100),
  weight_grams: z.number().finite().min(0).max(10000),
  length_cm: z.number().finite().positive().max(200),
  width_cm: z.number().finite().positive().max(200),
  height_cm: z.number().finite().positive().max(200),
  max_items: z.number().int().positive().max(100),
  max_content_weight_grams: z.number().finite().positive().max(100000),
  carrier_reference: z.string().trim().max(100).default(""),
})
export type PackagingSettings = z.infer<typeof packagingSchema>
export const optionSettingsSchema = packagingSchema.extend({ packaging_id: z.string().min(1) })
export type OptionSettings = z.infer<typeof optionSettingsSchema>
