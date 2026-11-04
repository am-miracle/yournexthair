import React from "react"
import { CreditCard } from "@medusajs/icons"

/* Map of payment provider_id to their display title and icon */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_bachs_bachs: {
    title: "Card / Bank Transfer / Mobile Money",
    icon: <CreditCard />,
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
}

export const isBachs = (providerId?: string) =>
  providerId?.startsWith("pp_bachs")

export const isManual = (providerId?: string) =>
  providerId?.startsWith("pp_system_default")
