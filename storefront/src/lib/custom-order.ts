import { z } from "zod"

export const NOT_SURE = "not_sure"

export const HAIR_TYPE_OPTIONS = [
  { id: NOT_SURE, label: "I'm not sure" },
  { id: "premium_virgin", label: "Premium virgin hair (6–7 weeks)" },
  { id: "raw", label: "Raw hair (9–12 weeks)" },
]

export const TEXTURE_OPTIONS = [
  NOT_SURE,
  "Straight",
  "Body Wave",
  "Loose Wave",
  "Deep Wave",
  "Water Wave",
  "Kinky Curly",
].map((id) => ({ id, label: id === NOT_SURE ? "I'm not sure" : id }))

export const LENGTH_OPTIONS = [
  { id: NOT_SURE, label: "I'm not sure" },
  ...Array.from({ length: 16 }, (_, index) => {
    const inches = 10 + index * 2
    return { id: `${inches} inches`, label: `${inches} inches` }
  }),
]

const whatsappDigits = (value: string) => value.replace(/[\s().-]/g, "")

export const customOrderSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(10, "Tell us a little more about the hair or wig you want.")
      .max(2000, "Keep your description under 2,000 characters."),
    hair_type: z.string(),
    texture: z.string(),
    length: z.string(),
    budget: z.string().trim().max(120),
    name: z.string().trim().min(2, "Enter your name.").max(120),
    whatsapp: z
      .string()
      .trim()
      .refine(
        (value) => /^(\+|00)?\d{8,15}$/.test(whatsappDigits(value)),
        "Enter a valid WhatsApp number.",
      ),
    email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
    country_code: z.string().min(2, "Choose your delivery country."),
    city: z.string().trim().min(2, "Enter your city.").max(120),
    website: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (
      values.country_code &&
      values.country_code !== "ng" &&
      whatsappDigits(values.whatsapp).startsWith("0")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "Include your country code, for example +44 7700 900123.",
      })
    }
  })

export type CustomOrderValues = z.infer<typeof customOrderSchema>

export const toSubmission = (values: CustomOrderValues, submissionKey: string) => {
  const specified = (value: string) => (value === NOT_SURE ? undefined : value)
  return {
    submission_key: submissionKey,
    name: values.name,
    whatsapp: values.whatsapp,
    email: values.email,
    description: values.description,
    country_code: values.country_code,
    city: values.city,
    hair_type: specified(values.hair_type),
    texture: specified(values.texture),
    length: specified(values.length),
    budget: values.budget,
    website: values.website,
  }
}

export type CustomOrderSubmission = ReturnType<typeof toSubmission>
