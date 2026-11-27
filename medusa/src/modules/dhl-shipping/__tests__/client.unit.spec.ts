import { DhlClient, addressLines, dhlApiUrl, plannedShippingDate } from "../client"
import { credentials, parcel } from "./fixtures"
import { logger } from "@medusajs/framework/logger"
jest.mock("@medusajs/framework/logger", () => ({ logger: { warn: jest.fn() } }))
jest.mock("@medusajs/framework/utils", () => ({
  MedusaError: class extends Error {
    static Types: Record<string, string> = {
      UNEXPECTED_STATE: "unexpected_state",
      INVALID_DATA: "invalid_data",
    }
    constructor(_type: string, message: string) {
      super(message)
    }
  },
}))
afterEach(() => jest.restoreAllMocks())
it("restricts endpoints to the official sandbox/live hosts", () => {
  expect(dhlApiUrl("sandbox")).toBe("https://express.api.dhl.com/mydhlapi/test")
  expect(dhlApiUrl("live")).toBe("https://express.api.dhl.com/mydhlapi")
  expect(() => dhlApiUrl("typo")).toThrow()
})
it("uses Basic auth and parses shipment totals rather than price breakdowns", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        products: [
          {
            productCode: "N",
            productName: "DOMESTIC",
            totalPrice: [
              { currencyType: "BILLC", priceCurrency: "USD", price: 1 },
              { currencyType: "BILLC", priceCurrency: "NGN", price: 6500 },
            ],
          },
        ],
      }),
    ),
  )
  const result = await new DhlClient(credentials).getRates(parcel())
  expect(result[0]).toMatchObject({ amount: 6500, currency: "NGN", product_code: "N" })
  const [url, options] = fetchMock.mock.calls[0]!
  expect(url).toContain("/test/rates")
  expect(options?.headers).toMatchObject({
    Authorization: `Basic ${Buffer.from("api-user:api-password").toString("base64")}`,
  })
  const request = JSON.parse(options?.body as string)
  expect(request).toMatchObject({
    accounts: [{ number: "123456789", typeCode: "shipper" }],
    isCustomsDeclarable: false,
    productCode: "N",
    nextBusinessDay: true,
    customerDetails: {
      shipperDetails: { countyName: "Rivers" },
      receiverDetails: { countyName: "Rivers" },
    },
    packages: [{ weight: 0.6 }],
  })
  expect(request).not.toHaveProperty("monetaryAmount")
})
it("includes actual origin, line quantities, unit values and invoice for international goods", () => {
  const request = new DhlClient(credentials).shipmentRequest(
    parcel(true),
    "P",
    "ful_1",
    "2026-11-16T10:00:00GMT+01:00",
  )
  expect(request).toMatchObject({
    customerReferences: [{ value: "ful_1", typeCode: "CU" }],
    pickup: { isRequested: false },
    outputImageProperties: {
      allDocumentsInOneImage: true,
      encodingFormat: "pdf",
      imageOptions: [
        { typeCode: "label", templateName: "ECOM26_84_A4_001" },
        { typeCode: "waybillDoc", templateName: "ARCH_8X4_A4_002", hideAccountNumber: true },
        { typeCode: "invoice", templateName: "COMMERCIAL_INVOICE_P_10", invoiceType: "commercial" },
      ],
    },
    content: {
      isCustomsDeclarable: true,
      incoterm: "DAP",
      declaredValue: 240000,
      exportDeclaration: {
        lineItems: [
          {
            price: 120000,
            quantity: { value: 2 },
            manufacturerCountry: "CN",
            exportReasonType: "permanent",
            weight: { netValue: 0.5 },
          },
        ],
        shipmentType: "commercial",
      },
    },
  })
  const line = request.content.exportDeclaration?.lineItems[0]
  expect(line?.commodityCodes.map((code) => code.typeCode).sort()).toEqual(["inbound", "outbound"])
  expect(request.content.exportDeclaration?.placeOfIncoterm).toBe(
    parcel(true).delivery_address.city,
  )

  const domestic = new DhlClient(credentials).shipmentRequest(parcel(), "N", "ful_1")
  expect(domestic.content).not.toHaveProperty("exportDeclaration")
  expect(domestic.outputImageProperties.imageOptions.map((option) => option.typeCode)).toEqual([
    "label",
    "waybillDoc",
  ])
})
it("keeps label documents in the saved response and returns a tracking link", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        shipmentTrackingNumber: "1234567890",
        trackingUrl: "https://express.api.dhl.com/mydhlapi/shipments/1234567890/tracking",
        dispatchConfirmationNumber: "CONFIRM",
        documents: [{ imageFormat: "PDF", typeCode: "label", content: "JVBERg==" }],
      }),
    ),
  )
  const shipment = await new DhlClient(credentials).createShipment(
    parcel(),
    "N",
    "ful_1",
    plannedShippingDate(),
  )
  expect(shipment).toMatchObject({
    shipment_id: "1234567890",
    dispatch_confirmation_number: "CONFIRM",
    documents: [{ typeCode: "label" }],
    extras: { tracking_number: "1234567890" },
  })
  expect(shipment.extras).not.toHaveProperty("shipping_label")
  expect(shipment.extras.tracking_url).toContain("www.dhl.com/ng-en/home/tracking.html")
})
it("converts NGN-only international quotes for USD carts and declares customs value in NGN", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        products: [
          {
            productCode: "P",
            productName: "EXPRESS WORLDWIDE",
            totalPrice: [
              { currencyType: "BILLC", priceCurrency: "NGN", price: 75000 },
              { currencyType: "BASEC", priceCurrency: "EUR", price: 50 },
            ],
          },
        ],
      }),
    ),
  )
  const client = new DhlClient(credentials, { ngn_per_usd: 1500, margin_percent: 5 })
  const body = { ...parcel(true), currency: "USD" }
  body.parcel.items = body.parcel.items.map((item) => ({ ...item, value: 80, currency: "USD" }))

  expect((await client.getRates(body))[0]).toMatchObject({
    amount: 52.5,
    currency: "USD",
    billed_amount: 75000,
    billed_currency: "NGN",
  })
  const request = client.shipmentRequest(body, "P", "ful_1", "2026-11-16T10:00:00GMT+01:00")
  expect(request.content).toMatchObject({ declaredValue: 120000, declaredValueCurrency: "NGN" })
  expect(request.content.exportDeclaration?.lineItems[0]?.price).toBe(60000)
})
it("refuses USD quotes when no exchange rate is configured", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ products: [] })))
  await expect(
    new DhlClient(credentials, undefined).getRates({ ...parcel(true), currency: "USD" }),
  ).rejects.toThrow("International DHL pricing is not configured")
})
it("books pickups separately with the shipper as collection address", () => {
  const request = new DhlClient(credentials).pickupRequest(
    parcel(),
    "N",
    "2026-11-16T10:00:00GMT+01:00",
  )
  expect(request).toMatchObject({
    plannedPickupDateAndTime: "2026-11-16T10:00:00GMT+01:00",
    accounts: [{ number: "123456789", typeCode: "shipper" }],
    customerDetails: { shipperDetails: { postalAddress: { cityName: "Port Harcourt" } } },
    shipmentDetails: [{ productCode: "N", isCustomsDeclarable: false }],
  })
})
it("redacts upstream response bodies", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response("private address and credential", { status: 400 }))
  await expect(new DhlClient(credentials).getRates(parcel())).rejects.toThrow(
    "DHL shipping request failed (400)",
  )
})
it("logs DHL's validation reason without exposing it to checkout", async () => {
  const warn = jest.mocked(logger.warn)
  jest.spyOn(global, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        title: "Unprocessable Entity",
        detail: "Multiple problems found, see Additional Details",
        additionalDetails: ["addressLine1 is too long"],
      }),
      { status: 422 },
    ),
  )
  await expect(new DhlClient(credentials).getRates(parcel())).rejects.toThrow(
    /^DHL shipping request failed \(422\)\. Contact the store\.$/,
  )
  expect(warn).toHaveBeenCalledWith(
    "DHL POST /rates rejected (422): Unprocessable Entity | Multiple problems found, see Additional Details | addressLine1 is too long",
  )
})
it("plans pickup on a weekday in Nigerian local time", () => {
  expect(plannedShippingDate(new Date("2026-11-13T12:00:00Z"))).toBe("2026-11-16T10:00:00GMT+01:00")
})
it("tells the customer to check the postal code when DHL rejects it", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ detail: "420506: Invalid Postcode Format." }), { status: 400 }),
    )
  await expect(new DhlClient(credentials).getRates(parcel(true))).rejects.toThrow(
    "Check the postal code in your delivery address.",
  )
})
describe("addressLines", () => {
  it("keeps lines that already fit", () => {
    expect(addressLines("12 Aba Road", "Flat 2")).toEqual(["12 Aba Road", "Flat 2"])
  })
  it("wraps a long address across DHL's three 45-character lines", () => {
    const lines = addressLines(
      "Plot 15, Block 4, Admiralty Way, Lekki Phase 1, Eti-Osa LGA",
      "Behind the filling station",
    )
    expect(lines.length).toBeLessThanOrEqual(3)
    expect(lines.every((line) => line.length <= 45)).toBe(true)
    expect(lines.join(" ")).toBe(
      "Plot 15, Block 4, Admiralty Way, Lekki Phase 1, Eti-Osa LGA, Behind the filling station",
    )
  })
  it("rejects an address that cannot fit", () => {
    expect(() => addressLines("word ".repeat(40))).toThrow("too long")
  })
})
it("sends long delivery addresses as separate DHL address lines", () => {
  const body = parcel()
  body.delivery_address.line1 = "Plot 15, Block 4, Admiralty Way, Lekki Phase 1, Eti-Osa LGA"
  const receiver = new DhlClient(credentials).rateRequest(body).customerDetails.receiverDetails
  expect(receiver.addressLine1.length).toBeLessThanOrEqual(45)
  expect(receiver).toHaveProperty("addressLine2")
})
