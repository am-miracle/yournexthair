import { bookDelivery, type Booking } from "../booking"

jest.mock("@medusajs/framework/utils", () => ({ MedusaError: class extends Error { static Types: Record<string, string> = { INVALID_DATA: "invalid_data" }; constructor(_type: string, message: string) { super(message) } } }))

const shipment = { shipment_id: "SH-1", status: "confirmed" }
function harness() {
  let row: Booking = { state: "pending", shipment_id: null, result: null }
  const store = {
    read: jest.fn(() => Promise.resolve({ ...row })),
    transition: jest.fn((expected: string, next: string, patch?: Partial<Booking>) => {
      if (row.state !== expected) return Promise.reject(new Error("Concurrent booking"))
      row = { ...row, ...patch, state: next }
      return Promise.resolve()
    }),
  }
  const client = {
    createDraft: jest.fn().mockResolvedValue("SH-1"),
    getShipmentRates: jest.fn().mockResolvedValue([{ amount: 5000, currency: "NGN", carrier_reference: "CA-1", carrier_name: "Courier", rate_id: "RT-1", pickup_options: [{ type: "pickup" }] }]),
    bookShipment: jest.fn().mockResolvedValue(shipment),
    getShipment: jest.fn().mockResolvedValue(shipment),
  }
  return { store, client, body: {}, currency: "NGN", carrier: "CA-1", maximumAmount: 5000 }
}
it("saves the draft and booking attempt before purchasing delivery; replay does not purchase again", async () => {
  const input = harness()
  input.client.bookShipment.mockImplementation(async () => {
    expect(await input.store.read()).toMatchObject({ state: "booking", shipment_id: "SH-1" })
    return shipment
  })
  await bookDelivery(input)
  await bookDelivery(input)
  expect(input.client.createDraft).toHaveBeenCalledTimes(1)
  expect(input.client.bookShipment).toHaveBeenCalledTimes(1)
})
it("reconciles a booking timeout without another charge", async () => {
  const input = harness()
  input.client.bookShipment.mockRejectedValueOnce(new Error("timeout after accepted"))
  await expect(bookDelivery(input)).rejects.toThrow("timeout")
  await expect(bookDelivery(input)).resolves.toEqual(shipment)
  expect(input.client.bookShipment).toHaveBeenCalledTimes(1)
})
it("does not blindly retry when a timed out shipment still reports draft", async () => {
  const input = harness()
  input.client.bookShipment.mockRejectedValueOnce(new Error("timeout"))
  input.client.getShipment.mockResolvedValue({ ...shipment, status: "draft" })
  await expect(bookDelivery(input)).rejects.toThrow()
  await expect(bookDelivery(input)).rejects.toThrow("uncertain")
  expect(input.client.bookShipment).toHaveBeenCalledTimes(1)
})
it("does not recreate a draft after an ambiguous creation failure", async () => {
  const input = harness()
  input.client.createDraft.mockRejectedValueOnce(new Error("timeout"))
  await expect(bookDelivery(input)).rejects.toThrow()
  await expect(bookDelivery(input)).rejects.toThrow("creation outcome")
  expect(input.client.createDraft).toHaveBeenCalledTimes(1)
  expect(input.client.bookShipment).not.toHaveBeenCalled()
})
it("blocks price increases and carrier changes before purchase", async () => {
  const input = harness()
  await expect(bookDelivery({ ...input, maximumAmount: 4000 })).rejects.toThrow("exceeds")
  await expect(bookDelivery({ ...input, carrier: "CA-2" })).rejects.toThrow("No courier")
  expect(input.client.bookShipment).not.toHaveBeenCalled()
})
