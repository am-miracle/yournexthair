import type { MedusaContainer } from "@medusajs/framework/types"
import { processDhlBooking } from "../process-booking"
import { DhlClient } from "../client"

jest.mock("../../dhl-operations", () => ({ DHL_OPERATIONS: "dhlOperations" }))
jest.mock("@medusajs/framework/utils", () => ({
  ContainerRegistrationKeys: { PG_CONNECTION: "db", QUERY: "query" },
  Modules: { FULFILLMENT: "fulfillment", STOCK_LOCATION: "stock_location" },
  MedusaError: class extends Error {
    static Types: Record<string, string> = { INVALID_DATA: "invalid_data" }
    constructor(_type: string, message: string) {
      super(message)
    }
  },
}))
const env = { ...process.env }
beforeEach(() => {
  process.env.DHL_AUTO_BOOKING = "true"
  process.env.DHL_API_USERNAME = "test"
  process.env.DHL_API_PASSWORD = "test"
  process.env.DHL_ACCOUNT_NUMBER = "123456789"
  process.env.DHL_ENVIRONMENT = "sandbox"
})
afterEach(() => {
  process.env = { ...env }
  jest.restoreAllMocks()
})

function fixture() {
  const row = {
    id: "booking_1",
    order_id: "order_1",
    fulfillment_id: "ful_1",
    environment: "sandbox",
    state: "pending",
    shipment_id: null as string | null,
    result: null,
    deleted_at: null,
  }
  const address = {
    first_name: "Test",
    last_name: "Contact",
    address_1: "1 Test Street",
    city: "Lagos",
    province: "Lagos",
    country_code: "ng",
    phone: "+2348000000000",
    postal_code: "100001",
  }
  const order = {
    id: "order_1",
    status: "pending",
    email: "customer@example.com",
    currency_code: "ngn",
    shipping_address: address,
    items: [
      {
        id: "item_1",
        title: "Wig",
        requires_shipping: true,
        quantity: 1,
        unit_price: 120000,
        variant: { weight: 250, length: 20, width: 15, height: 3 },
      },
    ],
    shipping_methods: [
      {
        shipping_option_id: "so_1",
        amount: 5000,
        data: { dhl_quote: { product_code: "CA-1", currency: "NGN", amount: 5000 } },
      },
    ],
    payment_collections: [
      { status: "completed", amount: 125000, captured_amount: 125000, refunded_amount: 0 },
    ],
  }
  const fulfillment = {
    id: "ful_1",
    provider_id: "dhl_dhl",
    shipping_option_id: "so_1",
    location_id: "loc_1",
    items: [{ line_item_id: "item_1", quantity: 1 }],
    delivery_address: address,
    labels: [],
    data: {},
    canceled_at: null as Date | null,
  }
  const updateFulfillment = jest.fn().mockResolvedValue({})
  const update = jest.fn((patch: Record<string, unknown>) => {
    Object.assign(row, patch)
    return Promise.resolve(1)
  })
  const chain = { where: jest.fn().mockReturnThis(), whereNull: jest.fn().mockReturnThis(), update }
  const services = {
    db: () => chain,
    query: { graph: jest.fn().mockResolvedValue({ data: [order] }) },
    dhlOperations: {
      listBookings: jest.fn().mockResolvedValue([row]),
      retrieveBooking: jest.fn(() => Promise.resolve({ ...row })),
      updateBookings: jest.fn().mockResolvedValue({}),
    },
    stock_location: { retrieveStockLocation: jest.fn().mockResolvedValue({ address }) },
    fulfillment: {
      retrieveFulfillment: jest.fn().mockResolvedValue(fulfillment),
      updateFulfillment,
      retrieveShippingOption: jest.fn().mockResolvedValue({
        data: {
          dhl_shipping: {
            name: "Measured box",
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
        },
      }),
    },
  }
  const container = {
    resolve: (name: keyof typeof services) => services[name],
  } as unknown as MedusaContainer
  const create = jest.spyOn(DhlClient.prototype, "createShipment").mockResolvedValue({
    shipment_id: "1234567890",
    status: "booked",
    extras: { tracking_number: "1234567890", tracking_url: "https://example.com/tracking" },
  })
  jest
    .spyOn(DhlClient.prototype, "getRates")
    .mockResolvedValue([
      { amount: 5000, currency: "NGN", product_code: "CA-1", carrier_name: "DHL" },
    ])
  const book = create

  return { container, row, order, fulfillment, create, book, updateFulfillment }
}
it("books a paid complete fulfillment and saves its tracking in Medusa", async () => {
  const f = fixture()
  await processDhlBooking(f.container, "order_1", "ful_1")
  expect(f.book).toHaveBeenCalledWith(
    expect.anything(),
    "CA-1",
    "ful_1",
    expect.any(String),
    undefined,
  )
  expect(f.row.state).toBe("booked")
  expect(f.updateFulfillment).toHaveBeenCalledWith("ful_1", {
    data: { booking_required: false, dhl_shipment_id: "1234567890", dhl_shipment_status: "booked" },
    labels: [
      {
        tracking_number: "1234567890",
        tracking_url: "https://example.com/tracking",
        label_url: "",
      },
    ],
  })
})
it("does not purchase courier delivery before capture or after a refund", async () => {
  for (const payment of [
    { status: "authorized", amount: 125000, captured_amount: 0, refunded_amount: 0 },
    { status: "completed", amount: 125000, captured_amount: 125000, refunded_amount: 125000 },
  ]) {
    const f = fixture()
    f.order.payment_collections = [payment]
    await expect(processDhlBooking(f.container, "order_1", "ful_1")).rejects.toThrow("full payment")
    expect(f.create).not.toHaveBeenCalled()
  }
})
it("does not spend a single delivery budget on partial fulfillments", async () => {
  const f = fixture()
  f.order.items[0]!.quantity = 2
  await expect(processDhlBooking(f.container, "order_1", "ful_1")).rejects.toThrow(
    "complete shippable order",
  )
  expect(f.book).not.toHaveBeenCalled()
})
it("requires staff to resolve a cancelled DHL waybill instead of pretending it was cancelled remotely", async () => {
  const f = fixture()
  f.row.state = "booked"
  f.row.shipment_id = "1234567890"
  f.fulfillment.canceled_at = new Date()
  await expect(processDhlBooking(f.container, "order_1", "ful_1")).rejects.toThrow(
    "cannot be cancelled",
  )
  expect(f.book).not.toHaveBeenCalled()
})
it("does not book against a ledger from a different environment", async () => {
  const f = fixture()
  f.row.environment = "live"
  await expect(processDhlBooking(f.container, "order_1", "ful_1")).rejects.toThrow(
    "identity mismatch",
  )
  expect(f.create).not.toHaveBeenCalled()
})
