import { describe, expect, it } from "vitest"
import {
  formatAddressLines,
  formatOrderDate,
  getOrderStage,
  isValidReturnPath,
} from "../order-format"

describe("formatOrderDate", () => {
  it("uses day-first dates in Lagos time regardless of the server locale", () => {
    expect(formatOrderDate("2026-11-13T23:30:00.000Z")).toBe("14 Nov 2026")
  })
})

describe("getOrderStage", () => {
  it("treats a cancelled order as cancelled even when nothing was fulfilled", () => {
    expect(getOrderStage({ status: "canceled", fulfillment_status: "not_fulfilled" })).toBe(
      "canceled",
    )
  })

  it("maps fulfillment progress", () => {
    expect(getOrderStage({ status: "pending", fulfillment_status: "delivered" })).toBe("delivered")
    expect(getOrderStage({ status: "pending", fulfillment_status: "partially_shipped" })).toBe(
      "shipped",
    )
    expect(getOrderStage({ status: "pending", fulfillment_status: "shipped" })).toBe("shipped")
    expect(getOrderStage({ status: "pending", fulfillment_status: "fulfilled" })).toBe("processing")
    expect(getOrderStage({ status: "pending" })).toBe("processing")
  })
})

describe("formatAddressLines", () => {
  it("includes the second line, state and phone, and skips empty parts", () => {
    expect(
      formatAddressLines({
        first_name: "Ada",
        last_name: "Obi",
        company: "",
        address_1: "15 Aba Road",
        address_2: "Flat 2",
        city: "Port Harcourt",
        province: "Rivers",
        postal_code: "500272",
        phone: "+2348030000000",
        country: { display_name: "Nigeria" },
      }),
    ).toEqual([
      "Ada Obi",
      "15 Aba Road",
      "Flat 2",
      "Port Harcourt, Rivers 500272",
      "Nigeria",
      "+2348030000000",
    ])
  })

  it("returns nothing for a missing address", () => {
    expect(formatAddressLines(null)).toEqual([])
  })
})

describe("isValidReturnPath", () => {
  it("accepts only same-site paths under the current country", () => {
    expect(isValidReturnPath("/ng/account/my-orders/order_1", "ng")).toBe(true)
    expect(isValidReturnPath("//evil.example/ng/", "ng")).toBe(false)
    expect(isValidReturnPath("https://evil.example", "ng")).toBe(false)
    expect(isValidReturnPath("/ng\\@evil.example", "ng")).toBe(false)
    expect(isValidReturnPath("/gb/account", "ng")).toBe(false)
    expect(isValidReturnPath(undefined, "ng")).toBe(false)
  })
})
