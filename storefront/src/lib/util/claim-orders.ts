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
    if (separator < 1 || !ORDER_ID.test(orderId) || !TOKEN.test(token) || claims.has(orderId))
      continue
    claims.set(orderId, token)
  }
  return [...claims].slice(0, MAX_CLAIMS).map(([orderId, token]) => ({ orderId, token }))
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "authentication_required" | "invalid_claim" | "retryable" }

export const claimFragment = (claims: OrderClaim[]) =>
  claims.length ? `#c=${claims.map(({ orderId, token }) => `${orderId}.${token}`).join(",")}` : ""

const STORAGE_KEY = "pending-order-claims:v1"
const STORAGE_LIFETIME = 60 * 60 * 1000

type ClaimStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
type GetStorage = () => ClaimStorage

// Keep credentials in the current tab, never in authentication query parameters.
export function preserveClaims(claims: OrderClaim[], storage: GetStorage): boolean {
  try {
    if (claims.length) {
      storage().setItem(
        STORAGE_KEY,
        JSON.stringify({ fragment: claimFragment(claims), expires: Date.now() + STORAGE_LIFETIME }),
      )
    } else {
      storage().removeItem(STORAGE_KEY)
    }
    return true
  } catch {
    return false
  }
}

export function restoreClaimFragment(storage: GetStorage): string {
  try {
    const value: unknown = JSON.parse(storage().getItem(STORAGE_KEY) ?? "null")
    if (
      value &&
      typeof value === "object" &&
      "expires" in value &&
      "fragment" in value &&
      typeof value.expires === "number" &&
      value.expires > Date.now() &&
      typeof value.fragment === "string"
    ) {
      return claimFragment(parseClaimFragment(value.fragment))
    }
    storage().removeItem(STORAGE_KEY)
  } catch {
    // An original email fragment remains usable when session storage is blocked.
  }
  return ""
}

export async function submitClaims(
  claims: OrderClaim[],
  submit: (orderId: string, token: string) => Promise<ClaimResult>,
) {
  const outcomes = await Promise.allSettled(
    claims.map(({ orderId, token }) => Promise.resolve().then(() => submit(orderId, token))),
  )
  const remaining = claims.filter((_, index) => {
    const outcome = outcomes[index]
    return outcome?.status !== "fulfilled" || !outcome.value.ok
  })
  return {
    remaining,
    added: claims.length - remaining.length,
    authenticationRequired: outcomes.some(
      (outcome) =>
        outcome.status === "fulfilled" &&
        !outcome.value.ok &&
        outcome.value.reason === "authentication_required",
    ),
    invalid: outcomes.filter(
      (outcome) =>
        outcome.status === "fulfilled" &&
        !outcome.value.ok &&
        outcome.value.reason === "invalid_claim",
    ).length,
  }
}
