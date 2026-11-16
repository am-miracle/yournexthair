import { buildTeamEmail, notifyRecipients } from "../notifications"
import { InvalidWhatsappNumber, normalizeWhatsapp, parseSubmission } from "../submission"

const valid = {
  submission_key: "4f1c2b7e-3a51-4d8e-9a0a-6a1b2c3d4e5f",
  name: "  Ada Obi ",
  whatsapp: "0815 619 7614",
  description: "A 24-inch body wave frontal wig.",
  country_code: "NG",
  city: "Lagos",
}

describe("normalizeWhatsapp", () => {
  it.each([
    ["0815 619 7614", "ng", "+2348156197614"],
    ["+234 (815) 619-7614", "ng", "+2348156197614"],
    ["00447700900123", "gb", "+447700900123"],
    ["447700900123", "gb", "+447700900123"],
  ])("normalizes %s for %s", (raw, country, expected) => {
    expect(normalizeWhatsapp(raw, country)).toBe(expected)
  })

  it("refuses a national number outside Nigeria instead of guessing the country code", () => {
    expect(() => normalizeWhatsapp("07700 900123", "gb")).toThrow(InvalidWhatsappNumber)
  })

  it.each(["+12", "+0123456789", "phone me"])("rejects %s", (raw) => {
    expect(() => normalizeWhatsapp(raw, "ng")).toThrow(InvalidWhatsappNumber)
  })
})

describe("parseSubmission", () => {
  it("trims input, lowercases the country and treats blank optional fields as not sure", () => {
    expect(parseSubmission({ ...valid, email: "", texture: " ", budget: "" })).toMatchObject({
      name: "Ada Obi",
      whatsapp: "+2348156197614",
      country_code: "ng",
      email: null,
      texture: null,
      budget: null,
      hair_type: null,
    })
  })

  it.each([
    { submission_key: "retry-1" },
    { description: "wig" },
    { email: "not-an-email" },
    { hair_type: "synthetic" },
    { country_code: "Nigeria" },
  ])("rejects %o", (override) => {
    expect(() => parseSubmission({ ...valid, ...override })).toThrow()
  })
})

describe("team notification", () => {
  it("links to the Admin record and labels unknown specs as not sure", () => {
    const email = buildTeamEmail(
      {
        id: "creq_1",
        number: 1042,
        name: "Ada",
        whatsapp: "+2348156197614",
        email: null,
        description: "Wig",
        city: "Lagos",
        hair_type: "raw",
        texture: null,
        length: "24 inches",
        budget: null,
      },
      "Nigeria",
      "https://admin.example.com/",
    )
    expect(email.reference).toBe("YNH-1042")
    expect(email.admin_url).toBe("https://admin.example.com/app/custom-requests/creq_1")
    expect(email.whatsapp_url).toMatch(/^https:\/\/wa\.me\/2348156197614\?text=.*YNH-1042/)
    expect(email.request.details).toEqual([
      { label: "Hair type", value: "Raw hair" },
      { label: "Texture", value: "Not sure" },
      { label: "Length", value: "24 inches" },
      { label: "Budget", value: "Not sure" },
    ])
  })

  it("accepts a comma-separated recipient list", () => {
    expect(notifyRecipients(" a@x.com, ,b@x.com")).toEqual(["a@x.com", "b@x.com"])
    expect(notifyRecipients(undefined)).toEqual([])
  })
})
