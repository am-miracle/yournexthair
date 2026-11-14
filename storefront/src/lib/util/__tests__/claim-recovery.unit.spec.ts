import { afterEach, expect, it, vi } from "vitest"
import {
  claimFragment,
  parseClaimFragment,
  preserveClaims,
  restoreClaimFragment,
  submitClaims,
  type ClaimResult,
} from "../claim-orders"
const claims = [
  { orderId: "order_1", token: "tok-1" },
  { orderId: "order_2", token: "tok-2" },
]
function session() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  return () => storage
}
afterEach(() => {
  vi.useRealTimers()
})
it("restores claims after navigating through sign-in with a clean return URL", () => {
  const storage = session()
  expect(preserveClaims(parseClaimFragment(claimFragment(claims)), storage)).toBe(true)
  expect(parseClaimFragment(restoreClaimFragment(storage))).toEqual(claims)
  // A failed login or a refresh does not consume the saved claims.
  expect(parseClaimFragment(restoreClaimFragment(storage))).toEqual(claims)
})
it("reports blocked storage without discarding the original fragment", () => {
  const storage = () => {
    throw new Error("Storage blocked")
  }
  const fragment = claimFragment(claims)
  expect(preserveClaims(claims, storage)).toBe(false)
  expect(restoreClaimFragment(storage)).toBe("")
  expect(parseClaimFragment(fragment)).toEqual(claims)
})
it("expires pending tab storage after one hour", () => {
  vi.useFakeTimers()
  const storage = session()
  preserveClaims(claims, storage)
  vi.advanceTimersByTime(3600001)
  expect(restoreClaimFragment(storage)).toBe("")
})
it("retains claims when authentication expires", async () => {
  const outcome = await submitClaims(claims, async () => ({
    ok: false,
    reason: "authentication_required",
  }))
  expect(outcome).toMatchObject({ remaining: claims, added: 0, authenticationRequired: true })
})
it("retains rejected and failed requests while removing confirmed successes", async () => {
  const submit = vi
    .fn<(...args: string[]) => Promise<ClaimResult>>()
    .mockResolvedValueOnce({ ok: true })
    .mockRejectedValueOnce(new Error("Network unavailable"))
  const storage = session()
  preserveClaims(claims, storage)
  const outcome = await submitClaims(claims, submit)
  expect(outcome).toMatchObject({ added: 1, remaining: [claims[1]], authenticationRequired: false })
  preserveClaims(outcome.remaining, storage)
  const pending = parseClaimFragment(restoreClaimFragment(storage))
  expect(pending).toEqual([claims[1]])
  const retry = vi.fn<(...args: string[]) => Promise<ClaimResult>>().mockResolvedValue({ ok: true })
  const completed = await submitClaims(pending, retry)
  expect(retry).toHaveBeenCalledTimes(1)
  expect(retry).toHaveBeenCalledWith("order_2", "tok-2")
  expect(completed.remaining).toEqual([])
  preserveClaims(completed.remaining, storage)
  expect(restoreClaimFragment(storage)).toBe("")
})
it("keeps invalid and recoverable failures available without conflating their messages", async () => {
  const submit = vi
    .fn<(...args: string[]) => Promise<ClaimResult>>()
    .mockResolvedValueOnce({ ok: false, reason: "invalid_claim" })
    .mockResolvedValueOnce({ ok: false, reason: "retryable" })
  expect(await submitClaims(claims, submit)).toMatchObject({
    remaining: claims,
    invalid: 1,
    added: 0,
  })
})

it("contains synchronous submission errors without losing pending claims", async () => {
  const outcome = await submitClaims(claims, () => {
    throw new Error("Request could not start")
  })
  expect(outcome).toMatchObject({ remaining: claims, added: 0 })
})
