import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient()

export const ReactQueryProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

export const withReactQueryProvider = <T extends {}>(
  Component: React.FC<T>
) => {
  const WrappedComponent = (props: T) => (
    <ReactQueryProvider>
      <Component {...props} />
    </ReactQueryProvider>
  )

  WrappedComponent.displayName = `withReactQueryProvider(${Component.displayName || Component.name || "Component"})`

  return WrappedComponent
}
