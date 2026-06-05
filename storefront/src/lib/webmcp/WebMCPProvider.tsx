"use client"

import React from "react"
import { registerWebMCPTools } from "./register-tools"
import { useParams, useRouter } from "next/navigation"

export const WebMCPProvider = () => {
  const router = useRouter()
  const params = useParams<{ countryCode?: string }>()
  const countryCode =
    typeof params.countryCode === "string" ? params.countryCode : undefined

  React.useEffect(() => {
    const cleanup = registerWebMCPTools(router, countryCode)
    return cleanup
  }, [countryCode, router])

  return null
}
