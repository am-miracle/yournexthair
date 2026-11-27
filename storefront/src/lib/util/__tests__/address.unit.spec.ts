import { describe, expect, it } from "vitest"
import { isValidPhone, nigerianStateValue, normalizePhone } from "../address"

describe("normalizePhone", () => {
  it("turns local Nigerian numbers into +234 numbers", () => {
    expect(normalizePhone("0803 123 4567", "ng")).toBe("+2348031234567")
    expect(normalizePhone("2348031234567", "ng")).toBe("+2348031234567")
    expect(normalizePhone("803-123-4567", "ng")).toBe("+2348031234567")
    expect(normalizePhone("+234 803 123 4567", "ng")).toBe("+2348031234567")
  })

  it("only strips formatting for other countries", () => {
    expect(normalizePhone("+44 20 7946 0958", "gb")).toBe("+442079460958")
    expect(normalizePhone("0044 20 7946 0958", "gb")).toBe("+442079460958")
  })
})

describe("isValidPhone", () => {
  it("rejects numbers that are too short or not Nigerian", () => {
    expect(isValidPhone("+2348031234567", "ng")).toBe(true)
    expect(isValidPhone("+234803", "ng")).toBe(false)
    expect(isValidPhone("+442079460958", "ng")).toBe(false)
    expect(isValidPhone("+442079460958", "gb")).toBe(true)
    expect(isValidPhone("12345", "gb")).toBe(false)
  })
})

describe("nigerianStateValue", () => {
  it("matches the state names customers type", () => {
    expect(nigerianStateValue("Lagos State")).toBe("lagos")
    expect(nigerianStateValue("akwa  ibom")).toBe("akwa ibom")
    expect(nigerianStateValue("Abuja")).toBe("fct")
    expect(nigerianStateValue("PH")).toBeNull()
  })
})
