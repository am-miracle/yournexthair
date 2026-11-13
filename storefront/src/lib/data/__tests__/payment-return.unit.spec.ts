import React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const browser = vi.hoisted(() => ({ crossSite: true, cart: undefined as undefined | { value: string; sameSite?: string | undefined } }))
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: { sameSite?: string | undefined }) => {
      if (name === "_medusa_cart_id") browser.cart = { value, sameSite: options.sameSite }
    },
    // A cross-site top-level GET from hosted Bachs checkout sends Lax cookies, not Strict ones.
    get: (name: string) => name === "_medusa_cart_id" && browser.cart && (!browser.crossSite || browser.cart.sameSite === "lax")
      ? { value: browser.cart.value } : undefined,
  }),
}))
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))
vi.mock("@modules/checkout/components/bachs-return", () => ({ default: () => null }))

import { setCartId } from "../cookies"
import { preparePaymentReturn } from "../payment-return"
import BachsReturnPage from "../../../app/[countryCode]/(checkout)/checkout/bachs/return/page"

beforeEach(() => { browser.cart = undefined; browser.crossSite = true; vi.stubGlobal("React", React) })
afterEach(() => vi.unstubAllGlobals())
it("keeps the customer on payment confirmation instead of redirecting home after a cross-site payment return", async () => {
  await setCartId("cart_paid")
  const page = await BachsReturnPage({ params: Promise.resolve({ countryCode: "ng" }) })
  expect(page.props.countryCode).toBe("ng")
  expect(browser.cart?.sameSite).toBe("lax")
})

it("shows recovery information instead of redirecting home when no cart cookie is available", async () => {
  const page = await BachsReturnPage({ params: Promise.resolve({ countryCode: "ng" }) })
  expect(page.props.role).toBe("status")
  expect(JSON.stringify(page.props.children)).toContain("check your email")
})

it("upgrades an existing Strict cart cookie before leaving for hosted checkout", async () => {
  browser.cart = { value: "cart_existing", sameSite: "strict" }
  browser.crossSite = false
  await preparePaymentReturn()
  browser.crossSite = true
  const page = await BachsReturnPage({ params: Promise.resolve({ countryCode: "ng" }) })
  expect(page.props.countryCode).toBe("ng")
  expect(browser.cart.sameSite).toBe("lax")
})

it("does not send the customer to hosted checkout without a cart session", async () => {
  await expect(preparePaymentReturn()).rejects.toThrow("checkout session has expired")
})
