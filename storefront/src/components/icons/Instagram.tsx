import * as React from "react"

export const Instagram: React.FC<React.ComponentPropsWithoutRef<"svg">> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="17.25" cy="6.75" r="1" fill="currentColor" />
  </svg>
)
