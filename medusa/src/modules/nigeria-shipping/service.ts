import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculateShippingOptionPriceDTO,
  ICachingModuleService,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import { CarrierCache, cachingModuleStore } from "./cache"
import { domesticParcel, NigeriaCarrier, parcelSettings } from "./client"
import { carrierNames, type CarrierOptions } from "./config"

export default class NigeriaShippingService extends AbstractFulfillmentProviderService {
  static identifier = "nigeria"
  private readonly client: NigeriaCarrier
  private readonly logger: Logger

  constructor(
    container: { logger: Logger; caching?: ICachingModuleService },
    private readonly options: CarrierOptions,
  ) {
    super()
    this.logger = container.logger
    this.client = new NigeriaCarrier(
      options,
      new CarrierCache(
        cachingModuleStore(() => container.caching),
        (message) => this.logger.warn(message),
      ),
    )
  }

  private get name() {
    return carrierNames[this.options.carrier]
  }

  getFulfillmentOptions() {
    return Promise.resolve([{ id: this.options.carrier, name: this.name, is_return: false }])
  }

  validateOption(data: Record<string, unknown>) {
    return Promise.resolve(
      data.id === this.options.carrier && parcelSettings.safeParse(data.parcel).success,
    )
  }

  canCalculate() {
    return Promise.resolve(true)
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"],
  ) {
    try {
      if (optionData.live !== this.options.live) throw new Error("Carrier environment mismatch.")
      const settings = parcelSettings.parse(optionData.parcel)
      const quote = await this.client.quote(
        domesticParcel(context, settings.box_weight_grams),
        settings,
      )
      return { calculated_amount: quote.amount, is_calculated_price_tax_inclusive: true }
    } catch (error) {
      this.logger.warn(
        `${this.name} quote failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This carrier cannot quote the delivery address.",
      )
    }
  }

  validateFulfillmentData(
    _option: Record<string, unknown>,
    _data: Record<string, unknown>,
    _context: ValidateFulfillmentDataContext,
  ) {
    return Promise.resolve({ nigeria_carrier: this.options.carrier })
  }

  createFulfillment(data: Record<string, unknown>) {
    return Promise.resolve({ data, labels: [] })
  }

  cancelFulfillment(data: Record<string, unknown>) {
    if (typeof data.waybill === "string") {
      this.logger.warn(
        `Fulfillment cancelled in Medusa only. Cancel ${this.name} waybill ${data.waybill} with the carrier.`,
      )
    }
    return Promise.resolve(data)
  }
}
