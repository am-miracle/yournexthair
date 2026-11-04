import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import type { PackagingSettings } from "./config"

export const rateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string(),
  carrier_reference: z.string().min(1),
  carrier_name: z.string().min(1),
  delivery_time: z.string().optional(),
  dropoff_required: z.boolean().optional(),
})
export type TerminalRate = z.infer<typeof rateSchema>

export class TerminalClient {
  constructor(private readonly apiKey: string) {}

  async createPackaging(settings: PackagingSettings): Promise<string> {
    const data = await this.request("/packaging", {
      name: settings.name,
      type: "box",
      weight: settings.weight_grams / 1000,
      weight_unit: "kg",
      size_unit: "cm",
      length: settings.length_cm,
      width: settings.width_cm,
      height: settings.height_cm,
    })
    return z.object({ packaging_id: z.string().min(1) }).parse(data).packaging_id
  }

  async getRates(body: Record<string, unknown>): Promise<TerminalRate[]> {
    const data = await this.request("/rates/shipment/quotes", body)
    if (!Array.isArray(data)) throw new Error("Terminal returned an invalid rate list")
    return data.flatMap((entry: unknown) => {
      const result = rateSchema.safeParse(entry)
      return result.success ? [result.data] : []
    })
  }

  private async request(path: string, body: Record<string, unknown>): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`https://api.terminal.africa/v1${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Shipping quotes are temporarily unavailable. Please try again.")
    }
    // Do not expose upstream responses, which can contain addresses or credentials.
    if (!response.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Terminal shipping request failed (${response.status}). Please try again or contact the store.`)
    const envelope = z.object({ status: z.literal(true), data: z.unknown() }).safeParse(await response.json())
    if (!envelope.success) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Terminal returned an unsuccessful shipping response.")
    return envelope.data.data
  }
}
