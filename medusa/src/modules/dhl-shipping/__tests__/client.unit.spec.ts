import { DhlClient, dhlApiUrl, plannedShippingDate } from "../client"
import { credentials, parcel } from "./fixtures"
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
  expect(JSON.parse(options?.body as string)).toMatchObject({
    accounts: [{ number: "123456789", typeCode: "shipper" }],
    isCustomsDeclarable: false,
    packages: [{ weight: 0.6 }],
  })
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
    pickup: { isRequested: true },
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
            weight: { netValue: 0.5 },
          },
        ],
      },
    },
  })
  expect(
    new DhlClient(credentials).shipmentRequest(parcel(), "N", "ful_1").content,
  ).not.toHaveProperty("exportDeclaration")
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
it("redacts upstream response bodies", async () => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response("private address and credential", { status: 400 }))
  await expect(new DhlClient(credentials).getRates(parcel())).rejects.toThrow(
    "DHL shipping request failed (400)",
  )
})
it("plans pickup on a weekday in Nigerian local time", () => {
  expect(plannedShippingDate(new Date("2026-11-13T12:00:00Z"))).toBe("2026-11-16T10:00:00GMT+01:00")
})
