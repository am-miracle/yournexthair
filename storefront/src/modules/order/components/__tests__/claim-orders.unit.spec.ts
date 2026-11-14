import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { restoreClaimFragment } from "@lib/util/claim-orders"
const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  accept: vi.fn(),
  press: undefined as undefined | (() => void),
}))
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  // Exercise the hydrated view using a browser snapshot during static rendering.
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => string) => snapshot(),
}))
vi.mock("@lib/data/orders", () => ({ acceptOrderTransfer: mocks.accept }))
vi.mock("@/components/Button", () => ({
  Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => {
    mocks.press = onPress
    return React.createElement("button", null, children)
  },
}))
vi.mock("@/components/LocalizedLink", () => ({
  LocalizedButtonLink: () => null,
  LocalizedLink: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
}))
import { ClaimOrders } from "../ClaimOrders"
let storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
beforeEach(() => {
  vi.clearAllMocks()
  const values = new Map<string, string>()
  storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
  vi.stubGlobal("React", React)
  vi.stubGlobal("window", {
    location: { hash: "#c=order_1.tok-1", assign: mocks.assign },
    sessionStorage: storage,
  })
})
afterEach(() => vi.unstubAllGlobals())
it("offers sign-in instead of submitting claims while signed out", () => {
  const html = renderToStaticMarkup(
    React.createElement(ClaimOrders, { signedIn: false, countryCode: "ng" }),
  )
  expect(html).toContain("Sign in and continue")
  expect(html).not.toContain("Add it to my account")
  expect(mocks.accept).not.toHaveBeenCalled()
  mocks.press?.()
  expect(mocks.assign).toHaveBeenCalledWith("/ng/auth/login?redirect=%2Fng%2Fclaim-orders")
  expect(restoreClaimFragment(() => storage)).toBe("#c=order_1.tok-1")
  expect(window.location.hash).toBe("#c=order_1.tok-1")
})
it("restores claims after sign-in and still requires an explicit confirmation", () => {
  renderToStaticMarkup(React.createElement(ClaimOrders, { signedIn: false, countryCode: "ng" }))
  mocks.press?.()
  window.location.hash = ""
  const html = renderToStaticMarkup(
    React.createElement(ClaimOrders, { signedIn: true, countryCode: "ng" }),
  )
  expect(html).toContain("Add it to my account")
  expect(mocks.accept).not.toHaveBeenCalled()
})
it("keeps the original claim page open when browser storage is blocked", () => {
  Object.defineProperty(window, "sessionStorage", {
    get: () => {
      throw new Error("Blocked")
    },
    configurable: true,
  })
  renderToStaticMarkup(React.createElement(ClaimOrders, { signedIn: false, countryCode: "ng" }))
  expect(() => mocks.press?.()).not.toThrow()
  expect(mocks.assign).not.toHaveBeenCalled()
  expect(window.location.hash).toBe("#c=order_1.tok-1")
})
