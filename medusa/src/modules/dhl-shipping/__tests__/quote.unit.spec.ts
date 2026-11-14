import { buildQuoteRequest, selectRate, type ShippingContext } from "../quote"

// The quote logic only needs Medusa's error contract, not the application loader.
jest.mock("@medusajs/framework/utils", () => ({
  MedusaError: class extends Error {
    static Types: Record<string, string> = { INVALID_DATA: "invalid_data" }
    constructor(_type: string, message: string) {
      super(message)
    }
  },
}))

const settings = {
  name: "Wig box",
  environment: "sandbox",
  pickup_first_name: "Dispatch",
  pickup_last_name: "Contact",
  pickup_email: "dispatch@example.com",
  weight_grams: 100,
  length_cm: 30,
  width_cm: 25,
  height_cm: 10,
  max_items: 3,
  max_content_weight_grams: 2000,
  product_code: "",
}
const option = { id: "dhl-pickup", dhl_shipping: settings }
const address = {
  first_name: "Test",
  last_name: "Contact",
  phone: "+2348000000000",
  postal_code: "500001",
  address_1: "1 Test Street",
  city: "Port Harcourt",
  province: "ng-ri",
  country_code: "ng",
}
const context: ShippingContext = {
  currency_code: "ngn",
  email: "customer@example.com",
  from_location: { address },
  shipping_address: { ...address, city: "Lagos", province: "ng-la" },
  items: [
    {
      title: "Wig",
      quantity: 2,
      unit_price: 120000,
      variant: { weight: 250, length: 20, width: 15, height: 3 },
    },
  ],
}

describe("DHL shipping parcel", () => {
  it("uses variant weights in kg, quantities, values and the configured package", () => {
    const { body } = buildQuoteRequest(option, context)
    expect(body.pickup_address).toMatchObject({
      city: "Port Harcourt",
      state: "Rivers",
      country: "NG",
    })
    expect(body.delivery_address.state).toBe("Lagos")
    expect(body.parcel).toMatchObject({
      weight_unit: "kg",
      weight: 0.6,
      items: [{ quantity: 2, weight: 0.25, value: 240000 }],
    })
  })
  it("rejects missing variant weight instead of treating it as free shipping", () => {
    expect(() =>
      buildQuoteRequest(option, {
        ...context,
        items: [{ quantity: 1, unit_price: 1, variant: { weight: null } }],
      }),
    ).toThrow("variant weight")
  })
  it("rejects missing dimensions and unconfigured packaging", () => {
    expect(() =>
      buildQuoteRequest(option, {
        ...context,
        items: [{ quantity: 1, unit_price: 1, variant: { weight: 200 } }],
      }),
    ).toThrow("package length")
    expect(() => buildQuoteRequest({}, context)).toThrow("not been configured")
  })
  it("rejects missing pickup and delivery addresses", () => {
    expect(() => buildQuoteRequest(option, { ...context, from_location: null })).toThrow(
      "Pickup location",
    )
    expect(() => buildQuoteRequest(option, { ...context, shipping_address: null })).toThrow(
      "Delivery address",
    )
  })
  it("blocks orders exceeding packing capacity", () => {
    expect(() =>
      buildQuoteRequest(option, { ...context, items: [{ ...context.items?.[0], quantity: 4 }] }),
    ).toThrow("capacity")
    expect(() =>
      buildQuoteRequest(
        { ...option, dhl_shipping: { ...settings, max_content_weight_grams: 300 } },
        context,
      ),
    ).toThrow("capacity")
    expect(() =>
      buildQuoteRequest({ ...option, dhl_shipping: { ...settings, height_cm: 1 } }, context),
    ).toThrow("does not fit")
  })
  it("changes the quote fingerprint when quantities or destination change", () => {
    const original = buildQuoteRequest(option, context).fingerprint
    expect(
      buildQuoteRequest({ ...option, dhl_shipping: { ...settings, product_code: "P" } }, context)
        .fingerprint,
    ).not.toBe(original)
    expect(
      buildQuoteRequest(option, { ...context, items: [{ ...context.items?.[0], quantity: 1 }] })
        .fingerprint,
    ).not.toBe(original)
    expect(
      buildQuoteRequest(option, {
        ...context,
        shipping_address: { ...address, city: "Abuja", province: "FC" },
      }).fingerprint,
    ).not.toBe(original)
  })
  it("blocks packages registered in another environment", () => {
    expect(() =>
      buildQuoteRequest({ ...option, dhl_shipping: { ...settings, environment: "live" } }, context),
    ).toThrow("another DHL environment")
  })
  it("requires booking contact details before quoting a charge to the customer", () => {
    expect(() =>
      buildQuoteRequest(option, { ...context, shipping_address: { ...address, phone: "" } }),
    ).toThrow("phone number")
  })
  it("requires real origin and HS codes for international shipments", () => {
    const international = { ...context, shipping_address: { ...address, country_code: "de" } }
    expect(() => buildQuoteRequest(option, international)).toThrow("HS code")
    const items = [
      {
        ...context.items?.[0],
        variant: { ...context.items?.[0]?.variant, metadata: { hs_code: "670420" } },
      },
    ]
    expect(() => buildQuoteRequest(option, { ...international, items })).toThrow(
      "country of origin",
    )
    const configured = items.map((item) => ({
      ...item,
      variant: { ...item.variant, metadata: { hs_code: "670420", country_of_origin: "CN" } },
    }))
    expect(
      buildQuoteRequest(option, { ...international, items: configured }).body.parcel.items[0],
    ).toMatchObject({ hs_code: "670420", country_of_origin: "CN" })
  })
})

describe("DHL rate selection", () => {
  const rate = { amount: 5000, currency: "NGN", product_code: "N", carrier_name: "DHL" }
  it("selects the cheapest total in the cart currency", () => {
    expect(
      selectRate(
        [{ ...rate, amount: 2, currency: "USD" }, rate, { ...rate, amount: 6000 }],
        "NGN",
        "",
      ).amount,
    ).toBe(5000)
  })
  it("never substitutes another product or currency", () => {
    expect(() => selectRate([rate], "USD", "")).toThrow("No DHL")
    expect(() => selectRate([rate], "NGN", "P")).toThrow("No DHL")
  })
})
