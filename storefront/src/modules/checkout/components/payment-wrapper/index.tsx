"use client"

import * as React from "react"
import { StoreCart } from "@medusajs/types"

type WrapperProps = {
  children: React.ReactNode
  cart: StoreCart
}

const Wrapper: React.FC<WrapperProps> = ({ children }) => {
  return <div className="space-y-8 md:space-y-10">{children}</div>
}

export default Wrapper
