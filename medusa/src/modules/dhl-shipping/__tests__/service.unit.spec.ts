import type {
  CalculateShippingOptionPriceDTO,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import DhlShippingService from "../service"

jest.mock("@medusajs/framework/utils", () => ({
  AbstractFulfillmentProviderService: class {},
  MedusaError: class extends Error {
    static Types: Record<string, string> = {
      INVALID_DATA: "invalid_data",
      UNEXPECTED_STATE: "unexpected_state",
      NOT_ALLOWED: "not_allowed",
    }
    constructor(_type: string, message: string) {
      super(message)
    }
  },
}))

const option = {
  id: "dhl-pickup",
  dhl_shipping: {
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
  },
}
const address = {
  first_name: "Test",
  last_name: "Contact",
  phone: "+2348000000000",
  postal_code: "500001",
  address_1: "1 Test Street",
  city: "Port Harcourt",
  province: "Rivers",
  country_code: "ng",
}
const context = {
  id: "cart_1",
  currency_code: "ngn",
  email: "customer@example.com",
  from_location: { address },
  shipping_address: { ...address, city: "Lagos", province: "Lagos" },
  items: [
    {
      title: "Wig",
      quantity: 2,
      unit_price: 120000,
      variant: { weight: 250, length: 20, width: 15, height: 3 },
    },
  ],
} as unknown as CalculateShippingOptionPriceDTO["context"]
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const rates = (price = 6500) => ({
  products: [
    {
      productCode: "N",
      productName: "Courier",
      totalPrice: [{ price, priceCurrency: "NGN", currencyType: "BILLC" }],
    },
  ],
})
afterEach(() => {
  jest.restoreAllMocks()
})

it("uses server-calculated prices and ignores forged customer quote data", async () => {
  const mock = jest
    .spyOn(global, "fetch")
    .mockImplementation(() => Promise.resolve(response(rates())))
  const service = new DhlShippingService(
    {},
    { username: "test", password: "secret", account_number: "123456789" },
  )
  expect(
    await service.calculatePrice(option, { amount: 0, dhl_quote: { amount: 0 } }, context),
  ).toEqual({ calculated_amount: 6500, is_calculated_price_tax_inclusive: true })
  const data = await service.validateFulfillmentData(
    option,
    { amount: 0 },
    context as unknown as ValidateFulfillmentDataContext,
  )
  expect(data.dhl_quote).toMatchObject({ amount: 6500, carrier: "DHL Courier", currency: "NGN" })
  expect(mock).toHaveBeenCalledTimes(1)
  const fulfillment = await service.createFulfillment(data)
  expect(fulfillment.data.booking_required).toBe(true)
  expect(mock).toHaveBeenCalledTimes(1)
})

it("refreshes the quote when the customer's address changes", async () => {
  const mock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(response(rates()))
    .mockResolvedValueOnce(response(rates(8000)))
  const service = new DhlShippingService(
    {},
    { username: "test", password: "secret", account_number: "123456789" },
  )
  await service.calculatePrice(option, {}, context)
  const price = await service.calculatePrice(
    option,
    {},
    {
      ...context,
      shipping_address: { ...context.shipping_address!, city: "Abuja", province: "FC" },
    },
  )
  expect(price.calculated_amount).toBe(8000)
  expect(mock).toHaveBeenCalledTimes(2)
})

it("expires cached quotes after one minute", async () => {
  const mock = jest
    .spyOn(global, "fetch")
    .mockImplementation(() => Promise.resolve(response(rates())))
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000)
  const service = new DhlShippingService(
    {},
    { username: "test", password: "secret", account_number: "123456789" },
  )
  await service.calculatePrice(option, {}, context)
  clock.mockReturnValue(62000)
  await service.calculatePrice(option, {}, context)
  expect(mock).toHaveBeenCalledTimes(2)
})

it("does not turn API failure or malformed/zero rates into free shipping", async () => {
  const mock = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(response({ message: "private upstream data" }, 503))
    .mockResolvedValueOnce(response(rates(0)))
  const service = new DhlShippingService(
    {},
    { username: "test", password: "secret", account_number: "123456789" },
  )
  await expect(service.calculatePrice(option, {}, context)).rejects.toThrow("503")
  await expect(service.calculatePrice(option, {}, context)).rejects.toThrow("No DHL")
  expect(mock).toHaveBeenCalledTimes(2)
})
