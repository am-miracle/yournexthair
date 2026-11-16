import type { ComponentProps } from "react"
import AuthPasswordForgotResetEmail from "./auth-forgot-password"
import AuthPasswordResetEmail from "./auth-password-reset"
import CustomRequestConfirmationEmail from "./custom-request-confirmation"
import CustomRequestReceivedEmail from "./custom-request-received"
import OrderPlacedEmail from "./order-placed"
import OrderTransferEmail from "./order-transfer"
import WelcomeEmail from "./welcome"

// TODO: we should be able to use notification data in subjects too
export const subjects = {
  "auth-password-reset": "Reset your password",
  "order-placed": "Your order has been placed",
  "order-transfer": "Add your past orders to your account",
  "customer-welcome": "Welcome to YourNextHair!",
  "auth-forgot-password": "Reset your password",
  "custom-request-received": "New custom-order request",
  "custom-request-confirmation": "We've received your custom-order request",
} as const

const emails = {
  "auth-password-reset": AuthPasswordResetEmail,
  "order-placed": OrderPlacedEmail,
  "order-transfer": OrderTransferEmail,
  "customer-welcome": WelcomeEmail,
  "auth-forgot-password": AuthPasswordForgotResetEmail,
  "custom-request-received": CustomRequestReceivedEmail,
  "custom-request-confirmation": CustomRequestConfirmationEmail,
} as const

export type EmailTemplateKey = keyof typeof emails

export type EmailTemplatePropsMap = {
  [Key in EmailTemplateKey]: ComponentProps<(typeof emails)[Key]>
}

export default emails
