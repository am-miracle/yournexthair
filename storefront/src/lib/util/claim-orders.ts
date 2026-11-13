export type OrderClaim = { orderId: string; token: string }

const MAX_CLAIMS = 20
const ORDER_ID = /^order_[A-Za-z0-9]+$/
const TOKEN = /^[A-Za-z0-9-]+$/

export function parseClaimFragment(hash: string): OrderClaim[] {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("c")
  if (!value) return []

  const claims = new Map<string, string>()
  for (const entry of value.split(",")) {
    const separator = entry.indexOf(".")
    const orderId = entry.slice(0, separator)
    const token = entry.slice(separator + 1)
    if (separator < 1 || !ORDER_ID.test(orderId) || !TOKEN.test(token) || claims.has(orderId)) continue
    claims.set(orderId, token)
  }
  return [...claims].slice(0, MAX_CLAIMS).map(([orderId, token]) => ({ orderId, token }))
}
