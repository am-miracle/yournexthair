import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

// Never expose this service credential through NEXT_PUBLIC_ variables or client code.
export function getCheckoutKey(): string {
  const secret = process.env.RECEIPT_ACCESS_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("RECEIPT_ACCESS_SECRET must contain at least 32 bytes")
  }
  return createHmac("sha256", secret).update("storefront-checkout:v1").digest("base64url")
}

// Bind the cart to the browser that created it before allowing token issuance.
export function signCartCookie(cartId: string): string {
  const payload = `${cartId}.${Math.floor(Date.now() / 1000) + 7 * 86400}`
  const signature = createHmac("sha256", getCheckoutKey())
    .update(`cart:v1:${payload}`)
    .digest("base64url")
  return `${payload}.${signature}`
}

export function verifyCartCookie(cookie: string | undefined): string | undefined {
  if (!cookie) return undefined
  const [cartId, expires, signature, extra] = cookie.split(".")
  if (!cartId || !expires || !signature || extra !== undefined) return undefined
  if (!Number.isSafeInteger(Number(expires)) || Number(expires) <= Date.now() / 1000)
    return undefined
  const expected = createHmac("sha256", getCheckoutKey())
    .update(`cart:v1:${cartId}.${expires}`)
    .digest("base64url")
  const actual = Buffer.from(signature)
  const valid =
    actual.length === Buffer.byteLength(expected) && timingSafeEqual(actual, Buffer.from(expected))
  return valid ? cartId : undefined
}
