import { describe, it, expect } from "vitest"
import { parseHairMeta } from "../parse-hair-meta"

describe("parseHairMeta", () => {
  it("returns null for null input", () => {
    expect(parseHairMeta(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(parseHairMeta(undefined)).toBeNull()
  })

  it("returns null when the object contains no recognised hair fields", () => {
    expect(parseHairMeta({ unrelated_key: "something" })).toBeNull()
  })

  it("returns null when all recognised fields are empty strings", () => {
    expect(parseHairMeta({ hair_origin: "", texture: "" })).toBeNull()
  })

  it("returns null when all recognised fields are whitespace-only strings", () => {
    expect(parseHairMeta({ hair_origin: "   ", texture: "  " })).toBeNull()
  })

  describe("string fields", () => {
    it("extracts a valid string value", () => {
      const result = parseHairMeta({ hair_origin: "Brazilian" })
      expect(result?.hair_origin).toBe("Brazilian")
    })

    it("drops a non-string value for a string field", () => {
      const result = parseHairMeta({ hair_origin: 42, texture: "Body Wave" })
      expect(result?.hair_origin).toBeUndefined()
      expect(result?.texture).toBe("Body Wave")
    })

    it("drops an array in a string field", () => {
      const result = parseHairMeta({ hair_origin: ["Brazilian"], texture: "Straight" })
      expect(result?.hair_origin).toBeUndefined()
    })

    it("drops an object in a string field", () => {
      const result = parseHairMeta({ hair_origin: { value: "Brazilian" }, texture: "Curly" })
      expect(result?.hair_origin).toBeUndefined()
    })
  })

  describe("numeric fields", () => {
    it("extracts a valid number", () => {
      const result = parseHairMeta({ length_in_inches: 14 })
      expect(result?.length_in_inches).toBe(14)
    })

    it("preserves numeric 0 — does NOT treat it as missing", () => {
      const result = parseHairMeta({ length_in_inches: 0, hair_origin: "Brazilian" })
      expect(result?.length_in_inches).toBe(0)
    })

    it("coerces a numeric string to a number", () => {
      const result = parseHairMeta({ length_in_inches: "14", hair_origin: "Brazilian" })
      expect(result?.length_in_inches).toBe(14)
    })

    it("drops a non-numeric string in a number field", () => {
      const result = parseHairMeta({ length_in_inches: "not-a-number", hair_origin: "Brazilian" })
      expect(result?.length_in_inches).toBeUndefined()
    })

    it("drops NaN in a number field", () => {
      const result = parseHairMeta({ density: NaN, hair_origin: "Brazilian" })
      expect(result?.density).toBeUndefined()
    })

    it("drops an object in a number field", () => {
      const result = parseHairMeta({ density: { value: 150 }, hair_origin: "Brazilian" })
      expect(result?.density).toBeUndefined()
    })
  })

  describe("boolean fields", () => {
    it("extracts true", () => {
      const result = parseHairMeta({ pre_bleached: true, hair_origin: "Brazilian" })
      expect(result?.pre_bleached).toBe(true)
    })

    it("extracts false — does NOT treat it as missing", () => {
      const result = parseHairMeta({ pre_bleached: false, hair_origin: "Brazilian" })
      expect(result?.pre_bleached).toBe(false)
    })

    it("drops a string 'true' in a boolean field", () => {
      const result = parseHairMeta({ pre_bleached: "true", hair_origin: "Brazilian" })
      expect(result?.pre_bleached).toBeUndefined()
    })

    it("drops a number in a boolean field", () => {
      const result = parseHairMeta({ pre_bleached: 1, hair_origin: "Brazilian" })
      expect(result?.pre_bleached).toBeUndefined()
    })
  })

  describe("mixed / realistic payloads", () => {
    it("parses a complete wig metadata object", () => {
      const raw = {
        hair_origin: "Brazilian",
        hair_family: "Virgin",
        texture: "Body Wave",
        length_in_inches: 14,
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
        density: 150,
        fulfillment_mode: "ready_to_ship",
        pre_bleached: true,
        pre_plucked: false,
      }
      const result = parseHairMeta(raw)
      expect(result).not.toBeNull()
      expect(result?.hair_origin).toBe("Brazilian")
      expect(result?.length_in_inches).toBe(14)
      expect(result?.density).toBe(150)
      expect(result?.pre_bleached).toBe(true)
      expect(result?.pre_plucked).toBe(false)
    })

    it("silently drops malformed fields and still returns partial valid data", () => {
      const raw = {
        hair_origin: { nested: "bad" }, // malformed object
        texture: "Straight",            // valid
        length_in_inches: "not a num",  // malformed string
        density: 130,                   // valid
      }
      const result = parseHairMeta(raw)
      expect(result).not.toBeNull()
      expect(result?.hair_origin).toBeUndefined()
      expect(result?.texture).toBe("Straight")
      expect(result?.length_in_inches).toBeUndefined()
      expect(result?.density).toBe(130)
    })

    it("ignores unrecognised keys in the raw object", () => {
      const raw = {
        hair_origin: "Indian",
        unknown_field: "should not appear",
        another_unknown: 999,
      }
      const result = parseHairMeta(raw)
      expect(result).not.toBeNull()
      expect(Object.keys(result!)).not.toContain("unknown_field")
      expect(Object.keys(result!)).not.toContain("another_unknown")
    })
  })
})
