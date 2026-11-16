import { describe, expect, it } from "vitest"
import { customOrderWhatsappUrl } from "@lib/consultation"
import { NOT_SURE, customOrderSchema, toSubmission } from "@lib/custom-order"

const valid = {
  description: "A 24-inch body wave frontal wig.",
  hair_type: NOT_SURE,
  texture: "Body Wave",
  length: NOT_SURE,
  budget: "",
  name: "Ada",
  whatsapp: "0815 619 7614",
  email: "",
  country_code: "ng",
  city: "Lagos",
}

const errorPaths = (values: object) =>
  customOrderSchema.safeParse(values).error?.issues.map((issue) => issue.path.join("."))

describe("custom order form", () => {
  it("accepts a Nigerian national number and an empty optional email", () => {
    expect(customOrderSchema.safeParse(valid).success).toBe(true)
  })

  it("asks for a country code when a national number is used outside Nigeria", () => {
    expect(errorPaths({ ...valid, country_code: "gb", whatsapp: "07700 900123" })).toEqual([
      "whatsapp",
    ])
    expect(
      errorPaths({ ...valid, country_code: "gb", whatsapp: "+44 7700 900123" }),
    ).toBeUndefined()
  })

  it("requires the description, contact and delivery details", () => {
    expect(
      errorPaths({ ...valid, description: "wig", name: "", country_code: "", city: "" }),
    ).toEqual(["description", "name", "country_code", "city"])
  })

  it("sends unknown specifications as omitted rather than as a value", () => {
    const submission = toSubmission(customOrderSchema.parse(valid), "key")
    expect(submission).toMatchObject({ submission_key: "key", texture: "Body Wave" })
    expect(submission.hair_type).toBeUndefined()
    expect(submission.length).toBeUndefined()
  })

  it("puts the reference in the WhatsApp follow-up message", () => {
    const url = new URL(customOrderWhatsappUrl("YNH-1042"))
    expect(url.host).toBe("wa.me")
    expect(url.searchParams.get("text")).toContain("YNH-1042")
  })
})
