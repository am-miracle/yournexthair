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
    requestPickup: jest.fn().mockResolvedValue("PRG123"),
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
it("books once, schedules one pickup and reuses the saved waybill on replay", async () => {
  const f = fixture()
  const booked = { ...f.shipment, dispatch_confirmation_number: "PRG123" }
  expect(await bookDelivery(f.input)).toEqual(booked)
  expect(await bookDelivery(f.input)).toEqual(booked)
  expect(f.client.createShipment).toHaveBeenCalledTimes(1)
  expect(f.client.requestPickup).toHaveBeenCalledTimes(1)
  expect(f.booking).toMatchObject({ state: "booked", result: booked })
})
it("keeps the waybill when pickup fails and retries only the pickup", async () => {
  const f = fixture()
  f.client.requestPickup.mockRejectedValueOnce(new Error("pickup unavailable"))
  const first = await bookDelivery(f.input)
  expect(first.pickup_error).toContain("Waybill 1234567890 is booked")
  expect(f.booking).toMatchObject({ state: "booked", shipment_id: "1234567890" })

  expect(await bookDelivery(f.input)).toMatchObject({ dispatch_confirmation_number: "PRG123" })
  expect(f.client.createShipment).toHaveBeenCalledTimes(1)
  expect(f.client.requestPickup).toHaveBeenCalledTimes(2)
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
