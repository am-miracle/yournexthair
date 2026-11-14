import { createHmac, timingSafeEqual } from "node:crypto"

const LIFETIME = 30 * 24 * 60 * 60
const ISSUER = "medusa-receipts"
const AUDIENCE = "store-order-receipt"

function secret(): string {
  const value = process.env.RECEIPT_ACCESS_SECRET
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error("RECEIPT_ACCESS_SECRET must contain at least 32 bytes")
  }
  return value
}
function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url")
}
export function equalCredential(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
export function checkoutKey(): string {
  return sign("storefront-checkout:v1")
}
export function issueReceiptToken(orderId: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      sub: orderId,
      iss: ISSUER,
      aud: AUDIENCE,
      purpose: "receipt",
      iat,
      exp: iat + LIFETIME,
    }),
  ).toString("base64url")
  return `${payload}.${sign(`receipt:v1:${payload}`)}`
}
export function verifyReceiptToken(token: unknown, orderId: string): boolean {
  if (typeof token !== "string" || token.length > 2048) return false
  const parts = token.split(".")
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  if (!payload || !signature) return false
  if (!equalCredential(signature, sign(`receipt:v1:${payload}`))) return false
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!parsed || typeof parsed !== "object") return false
    const claims = parsed as Record<string, unknown>
    const now = Math.floor(Date.now() / 1000)
    return (
      claims.sub === orderId &&
      claims.iss === ISSUER &&
      claims.aud === AUDIENCE &&
      claims.purpose === "receipt" &&
      typeof claims.exp === "number" &&
      Number.isSafeInteger(claims.exp) &&
      typeof claims.iat === "number" &&
      Number.isSafeInteger(claims.iat) &&
      claims.iat <= now &&
      claims.exp > now &&
      claims.exp - claims.iat === LIFETIME
    )
  } catch {
    return false
  }
}
