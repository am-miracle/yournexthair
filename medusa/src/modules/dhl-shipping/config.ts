import { z } from "zod"

export const DHL_PROVIDER_ID = "dhl_dhl"
export const packagingSchema = z.object({
  name: z.string().trim().min(1).max(100),
  weight_grams: z.number().min(0).max(10000),
  length_cm: z.number().positive().max(200),
  width_cm: z.number().positive().max(200),
  height_cm: z.number().positive().max(200),
  max_items: z.number().int().positive().max(100),
  max_content_weight_grams: z.number().positive().max(100000),
  product_code: z.string().trim().max(6).default(""),
  pickup_first_name: z.string().trim().min(1).max(100),
  pickup_last_name: z.string().trim().min(1).max(100),
  pickup_email: z.email(),
})
export type PackagingSettings = z.infer<typeof packagingSchema>
export const optionSettingsSchema = packagingSchema.extend({
  environment: z.enum(["sandbox", "live"]),
})
export type OptionSettings = z.infer<typeof optionSettingsSchema>

export function dhlEnvironment(value = process.env.DHL_ENVIRONMENT ?? "sandbox") {
  if (value !== "sandbox" && value !== "live") {
    throw new Error("DHL_ENVIRONMENT must be sandbox or live.")
  }
  return value
}

export function optionalDhlCredentials() {
  const username = process.env.DHL_API_USERNAME
  const password = process.env.DHL_API_PASSWORD
  const account_number = process.env.DHL_ACCOUNT_NUMBER

  return username && password && account_number ? { username, password, account_number } : undefined
}

export function dhlCredentials() {
  const credentials = optionalDhlCredentials()
  if (!credentials) {
    throw new Error(
      "Configure DHL_API_USERNAME, DHL_API_PASSWORD and DHL_ACCOUNT_NUMBER on the backend.",
    )
  }
  return credentials
}
