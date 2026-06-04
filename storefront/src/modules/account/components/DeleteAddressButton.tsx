"use client"

import { UiConfirmButton } from "@/components/Dialog"
import { useDeleteCustomerAddress } from "hooks/customer"
export const DeleteAddressButton = ({
  addressId,
  children,
  ...rest
}: {
  addressId: string
  className?: string
  children: React.ReactNode
}) => {
  const { mutateAsync, isPending } = useDeleteCustomerAddress()

  return (
    <UiConfirmButton
      {...rest}
      onConfirm={async () => {
        await mutateAsync(addressId).catch((error) => {
          console.error(error)
        })
      }}
      isLoading={isPending}
    >
      {children}
    </UiConfirmButton>
  )
}
