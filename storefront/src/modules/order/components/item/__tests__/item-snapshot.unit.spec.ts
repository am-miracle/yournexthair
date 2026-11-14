import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { HttpTypes } from "@medusajs/types"
vi.mock("@/components/LocalizedLink", () => ({
  LocalizedLink: ({ children, ...props }: React.ComponentProps<"a">) =>
    React.createElement("a", props, children),
}))
vi.mock("@modules/products/components/thumbnail", () => ({
  default: ({ thumbnail, images }: { thumbnail?: string; images?: { url: string }[] }) =>
    React.createElement("span", null, thumbnail || images?.[0]?.url || "Image unavailable"),
}))
import Item from "../index"
beforeEach(() => vi.stubGlobal("React", React))
afterEach(() => vi.unstubAllGlobals())
const snapshot = {
  id: "item_1",
  title: "Original item",
  product_title: "Original product",
  product_handle: "original-product",
  thumbnail: "/original.jpg",
  variant_title: "Original variant",
  variant_option_values: { Length: "18 inches", Density: 150 },
  quantity: 2,
  unit_price: 100,
  subtotal: 200,
}
const liveVariant = {
  product: {
    title: "Changed product",
    thumbnail: "/current.jpg",
    images: [{ url: "/current-image.jpg" }],
  },
  options: [{ id: "opt_1", option: { title: "Length" }, value: "Changed option" }],
}
const render = (fields: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    React.createElement(Item, {
      currencyCode: "ngn",
      item: { ...snapshot, ...fields } as unknown as HttpTypes.StoreOrderLineItem,
    }),
  )
it("renders historical images, options and prices even when live variants differ", () => {
  const html = render({ variant: liveVariant })
  for (const text of ["Original product", "/original.jpg", "18 inches", "150", "NGN 200.00"])
    expect(html).toContain(text)
  for (const text of ["/current.jpg", "/current-image.jpg", "Changed option", "Changed product"])
    expect(html).not.toContain(text)
})
it("renders the same purchase details when the variant is deleted", () => {
  expect(render({ variant: undefined })).toBe(render({ variant: liveVariant }))
})
it("uses the persisted variant title when option snapshots are missing", () => {
  expect(render({ variant_option_values: null })).toContain("Original variant")
})
it("uses a placeholder and item title for incomplete historical snapshots", () => {
  const html = render({
    thumbnail: null,
    product_title: null,
    product_handle: null,
    variant_title: null,
    variant_option_values: null,
    variant: liveVariant,
  })
  expect(html).toContain("Image unavailable")
  expect(html).toContain("Original item")
  expect(html).not.toContain("/products/null")
  expect(html).not.toContain("/current")
})
it("ignores malformed option values rather than crashing or inventing details", () => {
  const html = render({
    variant_option_values: {
      valid: "Original value",
      nested: { value: "wrong" },
      empty: "",
      invalid: null,
      list: ["wrong"],
    },
  })
  expect(html).toContain("Original value")
  expect(html).not.toContain("wrong")
})

it.each(["/original.jpg", null])(
  "names the thumbnail link for the purchased product with image %s",
  (thumbnail) => {
    expect(render({ thumbnail })).toContain(
      'href="/products/original-product" aria-label="View Original product"',
    )
  },
)
it("uses the persisted item title for the image link when the product title is absent", () => {
  expect(render({ product_title: null })).toContain('aria-label="View Original item"')
})
