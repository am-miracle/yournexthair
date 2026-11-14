import { afterEach, expect, it, vi } from "vitest"
import { sdk } from "@lib/config"
import { listCartShippingMethods } from "../fulfillment"
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: vi.fn() } } }))
const fetchMock = vi.mocked(sdk.client.fetch)
afterEach(() => fetchMock.mockReset())

it("fetches the real calculated price instead of displaying an absent price as zero", async () => {
  fetchMock
    .mockResolvedValueOnce({
      shipping_options: [{ id: "so_terminal", price_type: "calculated", amount: null }],
    })
    .mockResolvedValueOnce({ shipping_option: { id: "so_terminal", amount: 6500 } })
  const options = await listCartShippingMethods("cart_1")
  expect(options[0]?.amount).toBe(6500)
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/store/custom/shipping-options/so_terminal/calculate",
    { method: "POST", body: { cart_id: "cart_1" }, cache: "no-store" },
  )
})
it("keeps fixed-price pickup when the courier quote fails", async () => {
  fetchMock
    .mockResolvedValueOnce({
      shipping_options: [
        { id: "pickup", price_type: "flat", amount: 0 },
        { id: "terminal", price_type: "calculated" },
      ],
    })
    .mockRejectedValueOnce(new Error("Courier unavailable"))
  expect(await listCartShippingMethods("cart_1")).toEqual([
    { id: "pickup", price_type: "flat", amount: 0 },
  ])
})
it("blocks delivery when all quotes fail or return an invalid amount", async () => {
  fetchMock
    .mockResolvedValueOnce({ shipping_options: [{ id: "terminal", price_type: "calculated" }] })
    .mockResolvedValueOnce({ shipping_option: { amount: null } })
  await expect(listCartShippingMethods("cart_1")).rejects.toThrow("delivery quote")
})
