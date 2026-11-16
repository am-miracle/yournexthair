import { z } from "zod"

export const CUSTOM_REQUEST_STATUSES = ["new", "quoted", "closed"] as const
export type CustomRequestStatus = (typeof CUSTOM_REQUEST_STATUSES)[number]

export const HAIR_TYPES = ["premium_virgin", "raw"] as const
export const HAIR_TYPE_LABELS = { premium_virgin: "Premium virgin hair", raw: "Raw hair" } as const

export const formatReference = (number: number) => `YNH-${number}`
export const referenceOf = (request: { number: number }) => formatReference(request.number)

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null)

export const submissionSchema = z.object({
  submission_key: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(7).max(25),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((value) => value || null)
    .pipe(z.string().email().nullable()),
  description: z.string().trim().min(10).max(2000),
  country_code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/),
  city: z.string().trim().min(2).max(120),
  hair_type: z.enum(HAIR_TYPES).optional().nullable().default(null),
  texture: optionalText(60),
  length: optionalText(60),
  budget: optionalText(120),
})

export type Submission = z.infer<typeof submissionSchema> & { whatsapp: string }

export class InvalidWhatsappNumber extends Error {}

// Customers in Nigeria usually type the national format (0815…); anywhere else we can't guess
// the country code, and quoting the wrong number on WhatsApp is worse than asking.
export function normalizeWhatsapp(raw: string, countryCode: string): string {
  const compact = raw.replace(/[\s().-]/g, "")
  let digits: string
  if (compact.startsWith("+")) {
    digits = compact.slice(1)
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2)
  } else if (compact.startsWith("0")) {
    if (countryCode !== "ng") {
      throw new InvalidWhatsappNumber("Include your country code, for example +44 7700 900123.")
    }
    digits = `234${compact.slice(1)}`
  } else {
    digits = compact
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new InvalidWhatsappNumber("Enter a valid WhatsApp number, including your country code.")
  }
  return `+${digits}`
}

export function parseSubmission(body: unknown): Submission {
  const parsed = submissionSchema.parse(body)
  return { ...parsed, whatsapp: normalizeWhatsapp(parsed.whatsapp, parsed.country_code) }
}

export const quoteUpdateSchema = z
  .object({
    status: z.enum(CUSTOM_REQUEST_STATUSES).optional(),
    quoted_amount: z.number().positive().nullable().optional(),
    quoted_currency: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{3}$/)
      .nullable()
      .optional(),
    admin_notes: z.string().max(5000).nullable().optional(),
  })
  .strict()
