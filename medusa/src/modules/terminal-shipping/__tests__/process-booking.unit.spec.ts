import type { MedusaContainer } from "@medusajs/framework/types"
import { processTerminalBooking } from "../process-booking"
import { TerminalClient } from "../client"

jest.mock("../../terminal-operations", () => ({ TERMINAL_OPERATIONS: "terminalOperations" }))
jest.mock("@medusajs/framework/utils", () => ({
  ContainerRegistrationKeys: { PG_CONNECTION: "db", QUERY: "query" },
  Modules: { FULFILLMENT: "fulfillment", STOCK_LOCATION: "stock_location" },
  MedusaError: class extends Error { static Types: Record<string, string> = { INVALID_DATA: "invalid_data" }; constructor(_type: string, message: string) { super(message) } },
}))
const env = { ...process.env }
beforeEach(() => { process.env.TERMINAL_AUTO_BOOKING = "true"; process.env.TERMINAL_SECRET_KEY = "test"; process.env.TERMINAL_ENVIRONMENT = "sandbox" })
afterEach(() => { process.env = { ...env }; jest.restoreAllMocks() })

function fixture() {
  const row = { id: "booking_1", order_id: "order_1", fulfillment_id: "ful_1", environment: "sandbox", state: "pending", shipment_id: null as string | null, result: null, deleted_at: null }
  const address = { first_name: "Test", last_name: "Contact", address_1: "1 Test Street", city: "Lagos", province: "Lagos", country_code: "ng", phone: "+2348000000000", postal_code: "100001" }
  const order = {
    id: "order_1", status: "pending", email: "customer@example.com", currency_code: "ngn", shipping_address: address,
    items: [{ id: "item_1", title: "Wig", requires_shipping: true, quantity: 1, unit_price: 120000, variant: { weight: 250, length: 20, width: 15, height: 3 } }],
    shipping_methods: [{ shipping_option_id: "so_1", amount: 5000, data: { terminal_quote: { carrier_reference: "CA-1", currency: "NGN", amount: 5000 } } }],
    payment_collections: [{ status: "completed", amount: 125000, captured_amount: 125000, refunded_amount: 0 }],
  }
  const fulfillment = { id: "ful_1", provider_id: "terminal_terminal", shipping_option_id: "so_1", location_id: "loc_1", items: [{ line_item_id: "item_1", quantity: 1 }], delivery_address: address, labels: [], data: {}, canceled_at: null as Date | null }
  const updateFulfillment = jest.fn().mockResolvedValue({})
  const update = jest.fn((patch: Record<string, unknown>) => { Object.assign(row, patch); return Promise.resolve(1) })
  const chain = { where: jest.fn().mockReturnThis(), whereNull: jest.fn().mockReturnThis(), update }
  const services = {
    db: () => chain,
    query: { graph: jest.fn().mockResolvedValue({ data: [order] }) },
    terminalOperations: {
      listBookings: jest.fn().mockResolvedValue([row]), retrieveBooking: jest.fn(() => Promise.resolve({ ...row })),
      updateBookings: jest.fn().mockResolvedValue({}),
    },
    stock_location: { retrieveStockLocation: jest.fn().mockResolvedValue({ address }) },
    fulfillment: { retrieveFulfillment: jest.fn().mockResolvedValue(fulfillment), updateFulfillment,
      retrieveShippingOption: jest.fn().mockResolvedValue({ data: { terminal_shipping: {
        name: "Measured box", environment: "sandbox", packaging_id: "PA-1", pickup_first_name: "Dispatch", pickup_last_name: "Contact", pickup_email: "dispatch@example.com",
        weight_grams: 100, length_cm: 30, width_cm: 25, height_cm: 10, max_items: 3, max_content_weight_grams: 2000, carrier_reference: "",
      } } }),
    },
  }
  const container = { resolve: (name: keyof typeof services) => services[name] } as unknown as MedusaContainer
  const create = jest.spyOn(TerminalClient.prototype, "createDraft").mockResolvedValue("SH-1")
  jest.spyOn(TerminalClient.prototype, "getShipmentRates").mockResolvedValue([{ rate_id: "RT-1", amount: 5000, currency: "NGN", carrier_reference: "CA-1", carrier_name: "Courier", pickup_options: [{ type: "pickup" }] }])
  const book = jest.spyOn(TerminalClient.prototype, "bookShipment").mockResolvedValue({ shipment_id: "SH-1", status: "confirmed", extras: { tracking_number: "TRACK-1", tracking_url: "https://example.com/tracking" } })
  const get = jest.spyOn(TerminalClient.prototype, "getShipment").mockResolvedValue({ shipment_id: "SH-1", status: "cancelled" })
  const cancel = jest.spyOn(TerminalClient.prototype, "cancelShipment").mockResolvedValue()
  return { container, row, order, fulfillment, create, book, get, cancel, updateFulfillment }
}
it("books a paid complete fulfillment and saves its tracking in Medusa", async () => {
  const f = fixture()
  await processTerminalBooking(f.container, "order_1", "ful_1")
  expect(f.book).toHaveBeenCalledWith("SH-1", "RT-1")
  expect(f.row.state).toBe("booked")
  expect(f.updateFulfillment).toHaveBeenCalledWith("ful_1", {
    data: { booking_required: false, terminal_shipment_id: "SH-1", terminal_shipment_status: "confirmed" },
    labels: [{ tracking_number: "TRACK-1", tracking_url: "https://example.com/tracking", label_url: "" }],
  })
})
it("does not purchase courier delivery before capture or after a refund", async () => {
  for (const payment of [{ status: "authorized", amount: 125000, captured_amount: 0, refunded_amount: 0 }, { status: "completed", amount: 125000, captured_amount: 125000, refunded_amount: 125000 }]) {
    const f = fixture(); f.order.payment_collections = [payment]
    await expect(processTerminalBooking(f.container, "order_1", "ful_1")).rejects.toThrow("full payment")
    expect(f.create).not.toHaveBeenCalled()
  }
})
it("does not spend a single delivery budget on partial fulfillments", async () => {
  const f = fixture(); f.order.items[0]!.quantity = 2
  await expect(processTerminalBooking(f.container, "order_1", "ful_1")).rejects.toThrow("complete shippable order")
  expect(f.book).not.toHaveBeenCalled()
})
it("confirms a cancelled shipment without buying another", async () => {
  const f = fixture(); f.row.state = "booked"; f.row.shipment_id = "SH-1"; f.fulfillment.canceled_at = new Date()
  f.get.mockResolvedValueOnce({ shipment_id: "SH-1", status: "confirmed" }).mockResolvedValueOnce({ shipment_id: "SH-1", status: "cancelled" })
  await processTerminalBooking(f.container, "order_1", "ful_1")
  expect(f.cancel).toHaveBeenCalledWith("SH-1")
  expect(f.row.state).toBe("cancelled")
  expect(f.book).not.toHaveBeenCalled()
})
it("does not book against a ledger from a different environment", async () => {
  const f = fixture(); f.row.environment = "live"
  await expect(processTerminalBooking(f.container, "order_1", "ful_1")).rejects.toThrow("identity mismatch")
  expect(f.create).not.toHaveBeenCalled()
})
