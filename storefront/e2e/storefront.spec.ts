import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import { addFirstProductToCart, COUNTRY } from "./helpers"

test("home and store pages load", async ({ page }) => {
  await page.goto(`/${COUNTRY}`)
  await expect(page.getByRole("link", { name: "YourNextHair" }).first()).toBeVisible()

  await page.goto(`/${COUNTRY}/store`)
  await expect(page.locator(`a[href*="/${COUNTRY}/products/"]`).first()).toBeVisible()
})

test("guest can buy a product with manual payment", async ({ page }) => {
  await addFirstProductToCart(page)

  await page.getByRole("link", { name: "Proceed to checkout" }).first().click()
  await page.waitForURL(/\/checkout\?step=email/)

  await page.getByPlaceholder("Email").fill(`guest+${Date.now()}@example.com`)
  await page.getByRole("button", { name: "Next" }).click()
  await page.waitForURL(/step=delivery/)

  await page.getByLabel("Shipping first name").fill("Ada")
  await page.getByLabel("Shipping last name").fill("Obi")
  await page.getByLabel("Shipping address line 1").fill("12 Aba Road")
  await page.getByLabel("Shipping postal code").fill("500001")
  await page.getByLabel("Shipping city").fill("Port Harcourt")

  const country = page.getByRole("button", { name: /shipping country/i })
  if (!(await country.textContent())?.includes("Nigeria")) {
    await country.click()
    await page.getByRole("option", { name: "Nigeria" }).click()
  }

  await page.getByRole("button", { name: "Next" }).click()
  await page.waitForURL(/step=shipping/)

  // The selection is saved to the cart first; Next only enables once that round-trip completes.
  await page
    .getByRole("radiogroup", { name: "Shipping methods" })
    .getByRole("radio")
    .first()
    .click({ force: true })
  const shippingNext = page.getByRole("button", { name: "Next" })
  await expect(shippingNext).toBeEnabled()
  await shippingNext.click()
  await page.waitForURL(/step=payment/)

  await page.getByTestId("submit-payment-button").click()
  await page.waitForURL(/step=review/)

  await page.getByTestId("submit-order-button").click()
  await page.waitForURL(/\/order\/confirmed\//, { timeout: 60_000 })
  await expect(page.getByText("Thank you for your order!")).toBeVisible()
})

test("customer can register and log back in", async ({ page }) => {
  const email = `customer+${Date.now()}@example.com`
  const loginPhrase = randomUUID()

  await page.goto(`/${COUNTRY}/auth/register`)
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Create account" }) })
  await form.getByPlaceholder("First name").fill("Ada")
  await form.getByPlaceholder("Last name").fill("Obi")
  await form.getByPlaceholder("Email").fill(email)
  await form.getByPlaceholder("Password", { exact: true }).fill(loginPhrase)
  await form.getByPlaceholder("Confirm password").fill(loginPhrase)
  await form.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL((url) => !url.pathname.includes("/auth/register"))

  await page.context().clearCookies()

  await page.goto(`/${COUNTRY}/auth/login`)
  const login = page.locator("form").filter({ has: page.getByRole("button", { name: "Log in" }) })
  await login.getByPlaceholder("Email").fill(email)
  await login.getByPlaceholder("Password").fill(loginPhrase)
  await login.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"))

  await page.goto(`/${COUNTRY}/account`)
  await expect(page).not.toHaveURL(/\/auth\/login/)
})
