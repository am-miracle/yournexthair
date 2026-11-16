export const whatsappUrl = (number: string, message: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`

export const followUpMessage = (name: string, reference: string) =>
  `Hello ${name}, this is Your Next Hair about your custom-order request ${reference}.`
