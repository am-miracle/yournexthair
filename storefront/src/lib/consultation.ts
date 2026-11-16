const STORE_WHATSAPP_NUMBER = "2348156197614"

export const whatsappUrl = (message: string) =>
  `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

export const HAIR_CONSULTATION_WHATSAPP_URL = whatsappUrl(
  "Hello Your Next Hair, I'd like to book a hair consultation.",
)

export const customOrderWhatsappUrl = (reference: string) =>
  whatsappUrl(
    `Hello Your Next Hair, I've just sent custom-order request ${reference}. I'd like to discuss it and share some reference photos.`,
  )
