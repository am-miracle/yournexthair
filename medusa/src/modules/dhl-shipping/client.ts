import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { dhlCredentials, dhlEnvironment } from "./config"
import { documentsSchema } from "./documents"
import type { buildQuoteRequest } from "./quote"

export function dhlApiUrl(environment?: string) {
  return `https://express.api.dhl.com/mydhlapi${dhlEnvironment(environment) === "sandbox" ? "/test" : ""}`
}

function trackingDetails(shipmentId: string) {
  return {
    tracking_number: shipmentId,
    tracking_url: `https://www.dhl.com/ng-en/home/tracking.html?tracking-id=${encodeURIComponent(shipmentId)}`,
  }
}

export const rateSchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string(),
  product_code: z.string().min(1),
  local_product_code: z.string().optional(),
  carrier_name: z.string().min(1),
  delivery_time: z.string().optional(),
})
export type DhlRate = z.infer<typeof rateSchema>
export const shipmentSchema = z.object({
  shipment_id: z.string().min(1),
  status: z.string(),
  dispatch_confirmation_number: z.string().optional(),
  documents: documentsSchema.optional(),
  extras: z.object({
    tracking_number: z.string(),
    tracking_url: z.string(),
    shipping_label: z.string().optional(),
  }),
})
export type DhlShipment = z.infer<typeof shipmentSchema>
export type ShipmentBody = ReturnType<typeof buildQuoteRequest>["body"]

export function plannedShippingDate(now = new Date()) {
  const date = new Date(now.getTime() + 3600000)
  date.setUTCDate(date.getUTCDate() + 1)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return `${date.toISOString().slice(0, 10)}T10:00:00GMT+01:00`
}
function postal(address: ShipmentBody["pickup_address"] | ShipmentBody["delivery_address"]) {
  return {
    postalCode: address.zip,
    cityName: address.city,
    countryCode: address.country,
    addressLine1: address.line1,
    ...(address.line2 ? { addressLine2: address.line2 } : {}),
    ...(address.country !== "NG"
      ? { provinceCode: address.state.replace(/^[A-Za-z]{2}-/, "").toUpperCase() }
      : {}),
  }
}
function contact(address: ShipmentBody["pickup_address"] | ShipmentBody["delivery_address"]) {
  const name = `${address.first_name} ${address.last_name}`.trim()
  return {
    postalAddress: postal(address),
    contactInformation: {
      fullName: name,
      companyName: name,
      phone: address.phone,
      ...(address.email ? { email: address.email } : {}),
    },
  }
}
export class DhlClient {
  private readonly baseUrl: string

  constructor(private readonly credentials = dhlCredentials()) {
    this.baseUrl = dhlApiUrl()
  }

  rateRequest(body: ShipmentBody, plannedDate = plannedShippingDate()) {
    return {
      customerDetails: {
        shipperDetails: postal(body.pickup_address),
        receiverDetails: postal(body.delivery_address),
      },
      accounts: [{ typeCode: "shipper", number: this.credentials.account_number }],
      plannedShippingDateAndTime: plannedDate,
      unitOfMeasurement: "metric",
      isCustomsDeclarable: body.pickup_address.country !== body.delivery_address.country,
      monetaryAmount: [
        {
          typeCode: "declaredValue",
          value: body.parcel.items.reduce((sum, item) => sum + item.value, 0),
          currency: body.currency,
        },
      ],
      estimatedDeliveryDate: { isRequested: true, typeCode: "QDDC" },
      returnStandardProductsOnly: true,
      packages: [{ weight: body.parcel.weight, dimensions: body.parcel.dimensions }],
    }
  }

  async getRates(body: ShipmentBody, plannedDate?: string): Promise<DhlRate[]> {
    const response = z
      .object({
        products: z
          .array(
            z.object({
              productCode: z.string(),
              localProductCode: z.string().optional(),
              productName: z.string(),
              totalPrice: z.array(
                z.object({
                  priceCurrency: z.string(),
                  price: z.number(),
                  currencyType: z.string(),
                }),
              ),
              deliveryCapabilities: z
                .object({ estimatedDeliveryDateAndTime: z.string().optional() })
                .optional(),
            }),
          )
          .default([]),
      })
      .parse(await this.request("/rates", this.rateRequest(body, plannedDate)))
    return response.products.flatMap((product) => {
      // Never convert currencies or confuse a breakdown line with the shipment total.
      const price =
        product.totalPrice.find(
          (entry) => entry.priceCurrency === body.currency && entry.currencyType === "BILLC",
        ) ?? product.totalPrice.find((entry) => entry.priceCurrency === body.currency)
      if (!price) {
        return []
      }
      const rate = rateSchema.safeParse({
        amount: price.price,
        currency: price.priceCurrency,
        product_code: product.productCode,
        local_product_code: product.localProductCode,
        carrier_name: `DHL ${product.productName}`,
        ...(product.deliveryCapabilities?.estimatedDeliveryDateAndTime
          ? { delivery_time: product.deliveryCapabilities.estimatedDeliveryDateAndTime }
          : {}),
      })
      return rate.success ? [rate.data] : []
    })
  }

  shipmentRequest(
    body: ShipmentBody,
    productCode: string,
    reference: string,
    plannedDate = plannedShippingDate(),
    localProductCode?: string,
  ) {
    if (!reference || reference.length > 35) {
      throw new Error("DHL fulfillment references must contain 1–35 characters.")
    }
    const international = body.pickup_address.country !== body.delivery_address.country
    return {
      plannedShippingDateAndTime: plannedDate,
      pickup: { isRequested: true, closeTime: "17:00" },
      productCode,
      ...(localProductCode ? { localProductCode } : {}),
      accounts: [{ typeCode: "shipper", number: this.credentials.account_number }],
      customerDetails: {
        shipperDetails: contact(body.pickup_address),
        receiverDetails: contact(body.delivery_address),
      },
      customerReferences: [{ value: reference, typeCode: "CU" }],
      outputImageProperties: {
        encodingFormat: "pdf",
        imageOptions: [
          { typeCode: "label", isRequested: true },
          ...(international
            ? [{ typeCode: "invoice", isRequested: true, invoiceType: "commercial" }]
            : []),
        ],
      },
      content: {
        packages: [{ weight: body.parcel.weight, dimensions: body.parcel.dimensions }],
        isCustomsDeclarable: international,
        description: body.parcel.description,
        declaredValue: body.parcel.items.reduce((sum, item) => sum + item.value, 0),
        declaredValueCurrency: body.currency,
        incoterm: "DAP",
        unitOfMeasurement: "metric",
        ...(international
          ? {
              exportDeclaration: {
                invoice: { number: reference, date: plannedDate.slice(0, 10) },
                exportReasonType: "permanent",
                exportReason: "Sale of hair products",
                lineItems: body.parcel.items.map((item, index) => ({
                  number: index + 1,
                  description: item.description,
                  price: item.value / item.quantity,
                  quantity: { value: item.quantity, unitOfMeasurement: "PCS" },
                  commodityCodes: [{ typeCode: "outbound", value: item.hs_code }],
                  manufacturerCountry: item.country_of_origin,
                  weight: {
                    netValue: item.weight * item.quantity,
                    grossValue: item.weight * item.quantity,
                  },
                })),
              },
            }
          : {}),
      },
    }
  }

  async createShipment(
    body: ShipmentBody,
    productCode: string,
    reference: string,
    plannedDate: string,
    localProductCode?: string,
  ): Promise<DhlShipment> {
    const result = z
      .object({
        shipmentTrackingNumber: z.string().min(1),
        trackingUrl: z.string().optional(),
        dispatchConfirmationNumber: z.string().optional(),
        documents: documentsSchema.optional(),
      })
      .parse(
        await this.request(
          "/shipments",
          this.shipmentRequest(body, productCode, reference, plannedDate, localProductCode),
        ),
      )
    return shipmentSchema.parse({
      shipment_id: result.shipmentTrackingNumber,
      status: "booked",
      documents: result.documents,
      dispatch_confirmation_number: result.dispatchConfirmationNumber,
      extras: trackingDetails(result.shipmentTrackingNumber),
    })
  }

  async getShipment(shipmentId: string) {
    const response = z
      .object({
        shipments: z.array(
          z.object({
            shipmentTrackingNumber: z.string(),
            events: z.array(z.object({ typeCode: z.string(), description: z.string() })).optional(),
            shipperReferences: z
              .array(z.object({ value: z.string(), typeCode: z.string().optional() }))
              .optional(),
          }),
        ),
      })
      .parse(
        await this.request(
          `/shipments/${encodeURIComponent(shipmentId)}/tracking`,
          undefined,
          "GET",
        ),
      )
    const shipment = response.shipments.find((entry) => entry.shipmentTrackingNumber === shipmentId)
    if (!shipment) {
      throw new Error("DHL did not return the saved waybill. Reconcile with DHL before continuing.")
    }
    return {
      shipment_id: shipmentId,
      status: shipment.events?.some((event) => event.typeCode === "OK") ? "delivered" : "booked",
      references: shipment.shipperReferences ?? [],
      extras: trackingDetails(shipmentId),
    }
  }

  private async request(
    path: string,
    body?: Record<string, unknown>,
    method = "POST",
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString("base64")}`,
          "Content-Type": "application/json",
          "x-version": "3.3.1",
          Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "DHL request outcome is unavailable. Check booking status before retrying.",
      )
    }
    // Upstream bodies may contain personal information. Never surface them in logs or checkout.
    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `DHL shipping request failed (${response.status}). Contact the store.`,
      )
    }
    return response.json()
  }
}
