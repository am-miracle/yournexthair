import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

// Shipping actions
export const listCartShippingMethods = async function (cartId: string) {
  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        query: { cart_id: cartId },
        cache: "no-store",
      }
    )
    .then(async ({ shipping_options }) => {
      const priced = await Promise.allSettled(shipping_options.map(async (option) => {
        if (option.price_type !== "calculated") return option

        const { shipping_option } = await sdk.client.fetch<{ shipping_option: HttpTypes.StoreShippingOption }>(
          `/store/custom/shipping-options/${option.id}/calculate`,
          { method: "POST", body: { cart_id: cartId }, cache: "no-store" },
        )
        if (typeof shipping_option.amount !== "number" || !Number.isFinite(shipping_option.amount) || shipping_option.amount < 0) {
          throw new Error("Shipping quote is unavailable.")
        }
        return shipping_option
      }))
      const available = priced.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
      if (!available.length && priced.some((result) => result.status === "rejected")) {
        throw new Error("We couldn’t get a delivery quote. Please try again or contact us for delivery assistance.")
      }
      return available
    })
}
