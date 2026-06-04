"use client"

import { Icon } from "@/components/Icon"
import { LocalizedButtonLink } from "@/components/LocalizedLink"
import { useCustomer } from "@/hooks/customer"

const LoginLink = ({ className }: { className: string }) => {
  const { data: customer } = useCustomer()
  return (
    <LocalizedButtonLink
      href={customer ? "/account" : "/auth/login"}
      prefetch={false}
      variant="ghost"
      className={className}
      aria-label="Open account"
    >
      <Icon name="user" className="w-6 h-6" />
    </LocalizedButtonLink>
  )
}

export default LoginLink
