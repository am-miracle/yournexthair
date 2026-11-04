import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type { CalculateShippingOptionPriceDTO, CreateFulfillmentResult, ValidateFulfillmentDataContext } from "@medusajs/framework/types"
import { TerminalClient, type TerminalRate } from "./client"
import { buildQuoteRequest, selectRate, type ShippingContext } from "./quote"

type Quote = { rate: TerminalRate; expires: number }
export default class TerminalShippingService extends AbstractFulfillmentProviderService {
  static identifier = "terminal"
  private readonly client: TerminalClient
  private readonly quotes = new Map<string, Quote>()

  constructor(_container: Record<string, unknown>, options: { api_key: string }) {
    super()
    if (!options.api_key) throw new Error("Terminal shipping requires an API key.")
    this.client = new TerminalClient(options.api_key)
  }

  getFulfillmentOptions() {
    return Promise.resolve([{ id: "terminal-pickup", name: "Live courier delivery", is_return: false }])
  }
  validateOption(data: Record<string, unknown>) { return Promise.resolve(data.id === "terminal-pickup") }
  canCalculate() { return Promise.resolve(true) }

  private async quote(optionData: Record<string, unknown>, context: ShippingContext) {
    const request = buildQuoteRequest(optionData, context)
    const now = Date.now()
    for (const [key, value] of this.quotes) if (value.expires <= now) this.quotes.delete(key)
    let quote = this.quotes.get(request.fingerprint)
    if (!quote) {
      const rates = await this.client.getRates(request.body)
      quote = { rate: selectRate(rates, request.body.currency, request.settings.carrier_reference), expires: Date.now() + 60000 }
      if (this.quotes.size >= 500) this.quotes.clear()
      this.quotes.set(request.fingerprint, quote)
    }
    return { ...quote, fingerprint: request.fingerprint }
  }

  async calculatePrice(optionData: CalculateShippingOptionPriceDTO["optionData"], _data: CalculateShippingOptionPriceDTO["data"], context: CalculateShippingOptionPriceDTO["context"]) {
    const { rate } = await this.quote(optionData, context)
    return { calculated_amount: rate.amount, is_calculated_price_tax_inclusive: true }
  }

  async validateFulfillmentData(optionData: Record<string, unknown>, _data: Record<string, unknown>, context: ValidateFulfillmentDataContext) {
    const quote = await this.quote(optionData, context)
    return { terminal_quote: {
      carrier: quote.rate.carrier_name,
      carrier_reference: quote.rate.carrier_reference,
      delivery_time: quote.rate.delivery_time ?? "",
      amount: quote.rate.amount,
      currency: quote.rate.currency,
      fingerprint: quote.fingerprint,
      quoted_at: new Date().toISOString(),
    } }
  }

  // Courier booking is deliberately an operations step. A quote never purchases a shipment.
  createFulfillment(data: Record<string, unknown>): Promise<CreateFulfillmentResult> {
    if (!data.terminal_quote) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A Terminal shipping quote is required before fulfillment.")
    return Promise.resolve({ data: { terminal_quote: data.terminal_quote, booking_required: true }, labels: [] })
  }
  cancelFulfillment() { return Promise.resolve({}) }
  createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return Promise.reject(new MedusaError(MedusaError.Types.NOT_ALLOWED, "Arrange return delivery manually with the courier."))
  }
}
