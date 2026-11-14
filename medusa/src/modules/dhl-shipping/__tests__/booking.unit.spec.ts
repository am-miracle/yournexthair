import { bookDelivery, type Booking } from "../booking"
import { parcel } from "./fixtures"
jest.mock("@medusajs/framework/utils", () => ({
  MedusaError: class extends Error {
    static Types: Record<string, string> = { INVALID_DATA: "invalid_data" }
    constructor(_type: string, message: string) {
      super(message)
    }
  },
}))
function fixture() {
  const booking: Booking = { state: "pending", shipment_id: null, result: null }
  const store = {
    read: () => Promise.resolve({ ...booking }),
    transition: jest.fn((expected: string, next: string, patch = {}) => {
      if (booking.state !== expected) {
        throw new Error("concurrent update")
      }
      Object.assign(booking, patch, { state: next })
      return Promise.resolve()
    }),
  }
  const shipment = {
    shipment_id: "1234567890",
    status: "booked",
    extras: { tracking_number: "1234567890", tracking_url: "https://www.dhl.com/track" },
  }
  const client = {
    getRates: jest
      .fn()
      .mockResolvedValue([
        { product_code: "N", amount: 5000, currency: "NGN", carrier_name: "DHL" },
      ]),
    createShipment: jest.fn().mockResolvedValue(shipment),
    getShipment: jest.fn(),
  }
  return {
    booking,
    store,
    client,
    shipment,
    input: {
      store,
      client,
      body: parcel(),
      reference: "ful_1",
      currency: "NGN",
      productCode: "N",
      maximumAmount: 5000,
    },
  }
}
it("books once and reuses the saved waybill on replay", async () => {
  const f = fixture()
  expect(await bookDelivery(f.input)).toEqual(f.shipment)
  expect(await bookDelivery(f.input)).toEqual(f.shipment)
  expect(f.client.createShipment).toHaveBeenCalledTimes(1)
  expect(f.booking.state).toBe("booked")
})
it("never repeats shipment creation after a timeout", async () => {
  const f = fixture()
  f.client.createShipment.mockRejectedValue(new Error("timeout"))
  await expect(bookDelivery(f.input)).rejects.toThrow("timeout")
  await expect(bookDelivery(f.input)).rejects.toThrow("outcome is unknown")
  expect(f.client.createShipment).toHaveBeenCalledTimes(1)
})
it("blocks increased prices and currency/product substitution before spending", async () => {
  for (const rate of [
    { product_code: "N", amount: 5001, currency: "NGN", carrier_name: "DHL" },
    { product_code: "P", amount: 1, currency: "NGN", carrier_name: "DHL" },
    { product_code: "N", amount: 1, currency: "USD", carrier_name: "DHL" },
  ]) {
    const f = fixture()
    f.client.getRates.mockResolvedValue([rate])
    await expect(bookDelivery(f.input)).rejects.toThrow()
    expect(f.client.createShipment).not.toHaveBeenCalled()
    expect(f.booking.state).toBe("pending")
  }
})
it("allows only one worker across the durable creation boundary", async () => {
  const f = fixture()
  await Promise.allSettled([bookDelivery(f.input), bookDelivery(f.input)])
  expect(f.client.createShipment).toHaveBeenCalledTimes(1)
})
