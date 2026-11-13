import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import type { PackagingSettings } from "./config"

export function terminalApiUrl(environment = process.env.TERMINAL_ENVIRONMENT ?? "sandbox") {
  if (environment !== "sandbox" && environment !== "live") throw new Error("TERMINAL_ENVIRONMENT must be sandbox or live.")
  return environment === "live" ? "https://api.terminal.africa/v1" : "https://sandbox.terminal.africa/v1"
}

export const rateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string(),
  carrier_reference: z.string().min(1),
  carrier_name: z.string().min(1),
  delivery_time: z.string().optional(),
  dropoff_required: z.boolean().optional(),
  rate_id: z.string().optional(),
  pickup_options: z.array(z.object({ type: z.string() })).optional(),
})
export type TerminalRate = z.infer<typeof rateSchema>

export class TerminalClient {
  constructor(private readonly apiKey: string, private readonly baseUrl = terminalApiUrl()) {}

  async createDraft(body: Record<string, unknown>): Promise<string> {
    return z.object({ shipment_id: z.string().min(1) }).parse(await this.request("/shipments/quick", body)).shipment_id
  }

  async getShipment(shipmentId: string) {
    const shipment = shipmentSchema.parse(await this.request(`/shipments/${encodeURIComponent(shipmentId)}`, undefined, "GET"))
    if (shipment.shipment_id !== shipmentId) throw new Error("Terminal returned a different shipment. Reconciliation is required.")
    return shipment
  }

  async getShipmentRates(shipmentId: string, currency: string): Promise<TerminalRate[]> {
    return z.array(rateSchema).parse(await this.request(`/rates/shipment?shipment_id=${encodeURIComponent(shipmentId)}&currency=${encodeURIComponent(currency)}`, undefined, "GET"))
  }

  async bookShipment(shipmentId: string, rateId: string) {
    return shipmentSchema.parse(await this.request("/shipments/pickup", { shipment_id: shipmentId, rate_id: rateId, pickup_option: "pickup" }))
  }

  async cancelShipment(shipmentId: string) {
    await this.request("/shipments/cancel", { shipment_id: shipmentId })
  }

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

  private async request(path: string, body?: Record<string, unknown>, method = "POST"): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
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

export const shipmentSchema = z.object({
  shipment_id: z.string().min(1),
  status: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  extras: z.object({
    tracking_number: z.string().nullish(), tracking_url: z.string().nullish(),
    carrier_tracking_url: z.string().nullish(), shipping_label: z.string().nullish(),
  }).nullish(),
})
export type TerminalShipment = z.infer<typeof shipmentSchema>
