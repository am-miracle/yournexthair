import { buildQuoteRequest, selectRate, type ShippingContext } from "../quote"

// The quote logic only needs Medusa's error contract, not the application loader.
jest.mock("@medusajs/framework/utils", () => ({
  MedusaError: class extends Error {
    static Types: Record<string, string> = { INVALID_DATA: "invalid_data" }
    constructor(_type: string, message: string) { super(message) }
  },
}))

const settings = {
  name: "Wig box", packaging_id: "PA-1", environment: "sandbox", pickup_first_name: "Dispatch", pickup_last_name: "Contact", pickup_email: "dispatch@example.com", weight_grams: 100,
  length_cm: 30, width_cm: 25, height_cm: 10,
  max_items: 3, max_content_weight_grams: 2000, carrier_reference: "",
}
const option = { id: "terminal-pickup", terminal_shipping: settings }
const address = { first_name: "Test", last_name: "Contact", phone: "+2348000000000", postal_code: "500001", address_1: "1 Test Street", city: "Port Harcourt", province: "ng-ri", country_code: "ng" }
const context: ShippingContext = {
  currency_code: "ngn", email: "customer@example.com",
  from_location: { address }, shipping_address: { ...address, city: "Lagos", province: "ng-la" },
  items: [{ title: "Wig", quantity: 2, unit_price: 120000, variant: { weight: 250, length: 20, width: 15, height: 3 } }],
}

describe("Terminal shipping parcel", () => {
  it("uses variant weights in kg, quantities, values and the configured package", () => {
    const { body } = buildQuoteRequest(option, context)
    expect(body.pickup_address).toMatchObject({ city: "Port Harcourt", state: "Rivers", country: "NG" })
    expect(body.delivery_address.state).toBe("Lagos")
    expect(body.parcel).toMatchObject({ packaging: "PA-1", weight_unit: "kg", items: [{ quantity: 2, weight: 0.25, value: 240000 }] })
    expect(body.persist_data).toBe(false)
  })
  it("rejects missing variant weight instead of treating it as free shipping", () => {
    expect(() => buildQuoteRequest(option, { ...context, items: [{ quantity: 1, unit_price: 1, variant: { weight: null } }] })).toThrow("variant weight")
  })
  it("rejects missing dimensions and unconfigured packaging", () => {
    expect(() => buildQuoteRequest(option, { ...context, items: [{ quantity: 1, unit_price: 1, variant: { weight: 200 } }] })).toThrow("package length")
    expect(() => buildQuoteRequest({}, context)).toThrow("not been configured")
  })
  it("rejects missing pickup and delivery addresses", () => {
    expect(() => buildQuoteRequest(option, { ...context, from_location: null })).toThrow("Pickup location")
    expect(() => buildQuoteRequest(option, { ...context, shipping_address: null })).toThrow("Delivery address")
  })
  it("blocks orders exceeding packing capacity", () => {
    expect(() => buildQuoteRequest(option, { ...context, items: [{ ...context.items?.[0], quantity: 4 }] })).toThrow("capacity")
    expect(() => buildQuoteRequest({ ...option, terminal_shipping: { ...settings, max_content_weight_grams: 300 } }, context)).toThrow("capacity")
    expect(() => buildQuoteRequest({ ...option, terminal_shipping: { ...settings, height_cm: 1 } }, context)).toThrow("does not fit")
  })
  it("changes the quote fingerprint when quantities or destination change", () => {
    const original = buildQuoteRequest(option, context).fingerprint
    expect(buildQuoteRequest(option, { ...context, items: [{ ...context.items?.[0], quantity: 1 }] }).fingerprint).not.toBe(original)
    expect(buildQuoteRequest(option, { ...context, shipping_address: { ...address, city: "Abuja", province: "FC" } }).fingerprint).not.toBe(original)
  })
  it("blocks packages registered in another environment", () => {
    expect(() => buildQuoteRequest({ ...option, terminal_shipping: { ...settings, environment: "live" } }, context)).toThrow("another Terminal environment")
  })
  it("requires booking contact details before quoting a charge to the customer", () => {
    expect(() => buildQuoteRequest(option, { ...context, shipping_address: { ...address, phone: "" } })).toThrow("phone number")
  })
  it("requires customs data internationally and a manufacturer profile for EU goods", () => {
    const international = { ...context, shipping_address: { ...address, country_code: "de" } }
    expect(() => buildQuoteRequest(option, international)).toThrow("HS code")
    const items = [{ ...context.items?.[0], variant: { ...context.items?.[0]?.variant, metadata: { hs_code: "670420" } } }]
    expect(() => buildQuoteRequest(option, { ...international, items })).toThrow("manufacturer profile")
    const configured = [{ ...items[0], variant: { ...items[0]!.variant, metadata: { hs_code: "670420", manufacturers_profile: "AD-MAKER" } } }]
    expect(buildQuoteRequest(option, { ...international, items: configured }).body.parcel.items[0]).toMatchObject({ hs_code: "670420", manufacturers_profile: "AD-MAKER" })
  })
})

describe("Terminal rate selection", () => {
  const rate = { amount: 5000, currency: "NGN", carrier_reference: "CA-1", carrier_name: "Courier" }
  it("chooses the cheapest matching pickup service, excluding dropoff and currency mismatches", () => {
    const chosen = selectRate([{ ...rate, amount: 1, dropoff_required: true }, { ...rate, amount: 2, currency: "USD" }, rate, { ...rate, amount: 6000 }], "NGN", "")
    expect(chosen.amount).toBe(5000)
  })
  it("honors the selected carrier and never substitutes another currency or courier", () => {
    expect(() => selectRate([rate], "USD", "")).toThrow("No courier")
    expect(() => selectRate([rate], "NGN", "CA-2")).toThrow("No courier")
  })
  it("excludes dropoff-only, priority-only and scheduled-only pickup options", () => {
    for (const type of ["dropoff", "priority_pickup", "scheduled_pickup"]) {
      expect(() => selectRate([{ ...rate, pickup_options: [{ type }] }], "NGN", "")).toThrow("No courier")
    }
    expect(selectRate([{ ...rate, pickup_options: [{ type: "pickup" }] }], "NGN", "")).toEqual(expect.objectContaining({ amount: 5000 }))
  })
})
