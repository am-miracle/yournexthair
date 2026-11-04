import { expect, type Page } from "@playwright/test"

export const COUNTRY = "ng"

const selectFirstAvailable = async (page: Page) => {
  const groups = page.locator("main").getByRole("radiogroup")
  const count = await groups.count()

  for (let i = 0; i < count; i++) {
    const radios = groups.nth(i).getByRole("radio")
    const total = await radios.count()
    let checked = false

    for (let j = 0; j < total; j++) {
      if (await radios.nth(j).isChecked()) {
        checked = true
        break
      }
    }

    if (checked) {
      continue
    }

    for (let j = 0; j < total; j++) {
      const radio = radios.nth(j)
      if (await radio.isEnabled()) {
        await radio.check({ force: true })
        return true
      }
    }
  }

  return false
}

export const addFirstProductToCart = async (page: Page) => {
  await page.goto(`/${COUNTRY}/store`)
  const productLink = page.locator(`a[href*="/${COUNTRY}/products/"]`).first()
  await expect(productLink).toBeVisible()
  await productLink.click()
  await page.waitForURL(/\/products\//)

  const addToCart = page.getByRole("button", { name: /^add to cart$/i })

  // Options can depend on each other (a colour group appears after a material is picked).
  for (let attempt = 0; attempt < 8 && !(await addToCart.isVisible()); attempt++) {
    if (!(await selectFirstAvailable(page))) {
      break
    }
  }

  await expect(addToCart).toBeEnabled()
  // Adding runs as a Next.js server action; leaving the page before it settles cancels it.
  const added = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && !!response.request().headers()["next-action"],
  )
  await addToCart.click()
  expect((await added).ok()).toBe(true)

  await page.goto(`/${COUNTRY}/cart`)
  await expect(page.getByRole("link", { name: "Proceed to checkout" }).first()).toBeVisible()
}
