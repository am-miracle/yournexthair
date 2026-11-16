import type { CustomRequestConfirmationEmailProps } from "../resend/emails/custom-request-confirmation"
import type { CustomRequestReceivedEmailProps } from "../resend/emails/custom-request-received"
import { HAIR_TYPE_LABELS, formatReference } from "./submission"
import { followUpMessage, whatsappUrl } from "./whatsapp"

export const STORE_WHATSAPP_NUMBER = process.env.STORE_WHATSAPP_NUMBER ?? "2348156197614"

export type NotifiableRequest = {
  id: string
  number: number
  name: string
  whatsapp: string
  email: string | null
  description: string
  city: string
  hair_type: keyof typeof HAIR_TYPE_LABELS | null
  texture: string | null
  length: string | null
  budget: string | null
}

export const notifyRecipients = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

export function buildTeamEmail(
  request: NotifiableRequest,
  countryName: string,
  adminBaseUrl: string,
): CustomRequestReceivedEmailProps {
  const reference = formatReference(request.number)
  const details = [
    { label: "Hair type", value: request.hair_type ? HAIR_TYPE_LABELS[request.hair_type] : null },
    { label: "Texture", value: request.texture },
    { label: "Length", value: request.length },
    { label: "Budget", value: request.budget },
  ].map(({ label, value }) => ({ label, value: value ?? "Not sure" }))

  return {
    reference,
    admin_url: `${adminBaseUrl.replace(/\/+$/, "")}/app/custom-requests/${request.id}`,
    whatsapp_url: whatsappUrl(request.whatsapp, followUpMessage(request.name, reference)),
    request: {
      name: request.name,
      whatsapp: request.whatsapp,
      email: request.email,
      location: `${request.city}, ${countryName}`,
      description: request.description,
      details,
    },
  }
}

export function buildCustomerEmail(
  request: NotifiableRequest,
): CustomRequestConfirmationEmailProps {
  const reference = formatReference(request.number)
  return {
    reference,
    name: request.name,
    whatsapp: request.whatsapp,
    whatsapp_url: whatsappUrl(
      STORE_WHATSAPP_NUMBER,
      `Hello Your Next Hair, I'd like to share reference photos for my custom-order request ${reference}.`,
    ),
  }
}
