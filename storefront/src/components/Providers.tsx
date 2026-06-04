"use client"

import { QueryClientProvider } from "@tanstack/react-query"

import { getQueryClient } from "@lib/util/get-query-client"

export default function Providers(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  )
}
