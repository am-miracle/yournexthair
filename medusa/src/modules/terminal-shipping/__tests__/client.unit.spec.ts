import { TerminalClient, terminalApiUrl } from "../client"

jest.mock("@medusajs/framework/utils", () => ({ MedusaError: class extends Error { static Types: Record<string, string> = { UNEXPECTED_STATE: "unexpected_state" }; constructor(_type: string, message: string) { super(message) } } }))
afterEach(() => jest.restoreAllMocks())
const response = (data: unknown) => new Response(JSON.stringify({ status: true, data }))

it("uses only the documented sandbox or live host", () => {
  expect(terminalApiUrl("sandbox")).toBe("https://sandbox.terminal.africa/v1")
  expect(terminalApiUrl("live")).toBe("https://api.terminal.africa/v1")
  expect(() => terminalApiUrl("https://example.com")).toThrow("must be sandbox or live")
})
it("uses a saved draft identity for the paid booking request and never sends a customer price", async () => {
  const mock = jest.spyOn(global, "fetch").mockResolvedValue(response({ shipment_id: "SH-1", status: "confirmed" }))
  await new TerminalClient("test", terminalApiUrl("sandbox")).bookShipment("SH-1", "RT-1")
  const [url, init] = mock.mock.calls[0]!
  expect(url).toBe("https://sandbox.terminal.africa/v1/shipments/pickup")
  expect(JSON.parse(init?.body as string)).toEqual({ shipment_id: "SH-1", rate_id: "RT-1", pickup_option: "pickup" })
})
it("retrieves the same shipment with GET when reconciling", async () => {
  const mock = jest.spyOn(global, "fetch").mockResolvedValue(response({ shipment_id: "SH-1", status: "confirmed" }))
  await new TerminalClient("test", terminalApiUrl("sandbox")).getShipment("SH-1")
  expect(mock).toHaveBeenCalledWith("https://sandbox.terminal.africa/v1/shipments/SH-1", expect.objectContaining({ method: "GET" }))
  expect(mock.mock.calls[0]![1]).not.toHaveProperty("body")
})
it("fails closed if the paid API reports success without a shipment identity", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(response({ status: "confirmed" }))
  await expect(new TerminalClient("test").bookShipment("SH-1", "RT-1")).rejects.toThrow()
})
it("rejects a different shipment identity during reconciliation", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(response({ shipment_id: "SH-OTHER", status: "confirmed" }))
  await expect(new TerminalClient("test").getShipment("SH-1")).rejects.toThrow("different shipment")
})
