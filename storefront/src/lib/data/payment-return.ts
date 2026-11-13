"use server"

import { getCartId, setCartId } from "@lib/data/cookies"

export async function preparePaymentReturn() {
  const cartId = await getCartId()
  if (!cartId) throw new Error("Your checkout session has expired. Please reload your cart.")
  await setCartId(cartId)
}
