import React from "react"
import { CreditCard } from "@medusajs/icons"

/* Map of payment provider_id to their display title and icon */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_flutterwave_flutterwave: {
    title: "Card / Bank Transfer / Mobile Money",
    icon: <CreditCard />,
  },
  pp_paystack_paystack: {
    title: "Paystack (Cards, Bank, USSD)",
    icon: <CreditCard />,
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
}

export const isFlutterwave = (providerId?: string) =>
  providerId?.startsWith("pp_flutterwave")

export const isPaystack = (providerId?: string) =>
  providerId?.startsWith("pp_paystack")

export const isManual = (providerId?: string) =>
  providerId?.startsWith("pp_system_default")
