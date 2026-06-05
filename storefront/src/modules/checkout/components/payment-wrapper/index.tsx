"use client"

import * as React from "react"
import { StoreCart } from "@medusajs/types"

type WrapperProps = {
  children: React.ReactNode
  cart: StoreCart
}

// Flutterwave and Paystack both use inline popups (no provider context wrapper needed).
// Scripts are loaded in the checkout layout via next/script.
const Wrapper: React.FC<WrapperProps> = ({ children }) => {
  return <div className="space-y-8 md:space-y-10">{children}</div>
}

export default Wrapper
