import {
  getMissingPublishFields,
  FORM_FIELD_RULES,
  HAIR_FIELD_DEFS,
  PRODUCT_TYPE_TO_FORM,
  PRODUCT_FORMS,
  type ProductForm,
} from "../hair-fields"

describe("hair-fields config", () => {
  it("every product form has a rule entry for every field in HAIR_FIELD_DEFS", () => {
    const definedFields = Object.keys(HAIR_FIELD_DEFS)
    for (const form of PRODUCT_FORMS) {
      const ruleFields = Object.keys(FORM_FIELD_RULES[form])
      for (const field of definedFields) {
        expect(ruleFields).toContain(field)
      }
    }
  })

  it("FORM_FIELD_RULES contains no fields outside HAIR_FIELD_DEFS", () => {
    const definedFields = new Set(Object.keys(HAIR_FIELD_DEFS))
    for (const form of PRODUCT_FORMS) {
      for (const field of Object.keys(FORM_FIELD_RULES[form])) {
        expect(definedFields.has(field)).toBe(true)
      }
    }
  })

  it("every product_type.value in PRODUCT_TYPE_TO_FORM maps to a valid ProductForm", () => {
    const validForms = new Set<string>(PRODUCT_FORMS)
    for (const form of Object.values(PRODUCT_TYPE_TO_FORM)) {
      expect(validForms.has(form)).toBe(true)
    }
  })
})

describe("getMissingPublishFields", () => {
  describe("wig form", () => {
    const form: ProductForm = "wig"

    it("returns empty array when all required fields are present", () => {
      const meta = {
        length_in_inches: 14,
        hair_origin: "Brazilian",
        hair_family: "Virgin",
        texture: "Body Wave",
        fulfillment_mode: "ready_to_ship",
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
      }
      expect(getMissingPublishFields(meta, form)).toHaveLength(0)
    })

    it("returns missing required fields when absent", () => {
      const missing = getMissingPublishFields({}, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).toContain("length_in_inches")
      expect(missingFields).toContain("hair_origin")
      expect(missingFields).toContain("lace_size")
      expect(missingFields).toContain("lace_type")
      expect(missingFields).toContain("cap_construction")
    })

    it("does not include optional fields (density, pre_bleached, etc.)", () => {
      const meta = {
        length_in_inches: 14,
        hair_origin: "Brazilian",
        hair_family: "Virgin",
        texture: "Body Wave",
        fulfillment_mode: "ready_to_ship",
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
        // density and pre_bleached intentionally absent
      }
      const missing = getMissingPublishFields(meta, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).not.toContain("density")
      expect(missingFields).not.toContain("pre_bleached")
      expect(missingFields).not.toContain("limited_edition")
    })

    it("does not include hidden fields (bundle_deal)", () => {
      const missing = getMissingPublishFields({}, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).not.toContain("bundle_deal")
      expect(missingFields).not.toContain("sample_box_flag")
    })

    it("treats boolean false as a present value, not missing", () => {
      const meta = {
        length_in_inches: 14,
        hair_origin: "Brazilian",
        hair_family: "Virgin",
        texture: "Body Wave",
        fulfillment_mode: "ready_to_ship",
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
        pre_bleached: false,
      }
      const missing = getMissingPublishFields(meta, form)
      expect(missing.map((e) => e.field)).not.toContain("pre_bleached")
    })

    it("treats numeric 0 as a present value, not missing", () => {
      const meta = {
        length_in_inches: 0, // edge case: 0" is probably invalid data but not "missing"
        hair_origin: "Brazilian",
        hair_family: "Virgin",
        texture: "Body Wave",
        fulfillment_mode: "ready_to_ship",
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
      }
      const missing = getMissingPublishFields(meta, form)
      expect(missing.map((e) => e.field)).not.toContain("length_in_inches")
    })

    it("treats empty string as missing", () => {
      const meta = {
        length_in_inches: 14,
        hair_origin: "",
        hair_family: "Virgin",
        texture: "Body Wave",
        fulfillment_mode: "ready_to_ship",
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
      }
      const missing = getMissingPublishFields(meta, form)
      expect(missing.map((e) => e.field)).toContain("hair_origin")
    })

    it("treats null as missing", () => {
      const meta: Record<string, unknown> = {
        length_in_inches: 14,
        hair_origin: null,
        hair_family: "Virgin",
        texture: "Body Wave",
        fulfillment_mode: "ready_to_ship",
        lace_size: "13x4",
        lace_type: "HD",
        cap_construction: "Lace Front",
      }
      const missing = getMissingPublishFields(meta, form)
      expect(missing.map((e) => e.field)).toContain("hair_origin")
    })

    it("returns ValidationError objects with correct shape", () => {
      const missing = getMissingPublishFields({}, form)
      for (const err of missing) {
        expect(err).toMatchObject({
          field: expect.any(String),
          label: expect.any(String),
          rule: "required",
        })
      }
    })
  })

  describe("bundle form", () => {
    const form: ProductForm = "bundle"

    it("does not require lace_size, lace_type, cap_construction", () => {
      const missing = getMissingPublishFields({}, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).not.toContain("lace_size")
      expect(missingFields).not.toContain("lace_type")
      expect(missingFields).not.toContain("cap_construction")
    })

    it("requires the core hair attributes", () => {
      const missing = getMissingPublishFields({}, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).toContain("length_in_inches")
      expect(missingFields).toContain("hair_origin")
      expect(missingFields).toContain("texture")
      expect(missingFields).toContain("fulfillment_mode")
    })
  })

  describe("closure form", () => {
    const form: ProductForm = "closure"

    it("requires lace_size and lace_type but not cap_construction", () => {
      const missing = getMissingPublishFields({}, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).toContain("lace_size")
      expect(missingFields).toContain("lace_type")
      expect(missingFields).not.toContain("cap_construction")
    })
  })

  describe("sample_box form", () => {
    const form: ProductForm = "sample_box"

    it("only requires sample_box_flag", () => {
      const missing = getMissingPublishFields({}, form)
      const missingFields = missing.map((e) => e.field)
      expect(missingFields).toEqual(["sample_box_flag"])
    })

    it("passes with sample_box_flag set, regardless of other fields", () => {
      const meta = { sample_box_flag: true }
      expect(getMissingPublishFields(meta, form)).toHaveLength(0)
    })
  })
})
