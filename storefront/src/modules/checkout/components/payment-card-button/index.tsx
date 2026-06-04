"use client"

import * as React from "react"
import { HttpTypes } from "@medusajs/types"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/Button"
import { useInitiatePaymentSession } from "hooks/cart"

type Props = {
  cart: HttpTypes.StoreCart
  isLoading: boolean
  setIsLoading: (value: boolean) => void
  createQueryString: (name: string, value: string) => string
  selectedPaymentMethod: string
  setError: (value: string | null) => void
}

// Initiates the payment session for the selected provider and advances the
// checkout to the review step. The actual payment (popup/redirect) happens
// at the review → "Place order" step.
const PaymentCardButton: React.FC<Props> = ({
  isLoading,
  setIsLoading,
  createQueryString,
  selectedPaymentMethod,
  setError,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const initiatePaymentSession = useInitiatePaymentSession()

  const handleSubmit = () => {
    if (!selectedPaymentMethod) return

    setIsLoading(true)
    initiatePaymentSession.mutate(
      { providerId: selectedPaymentMethod },
      {
        onSuccess: () => {
          router.push(
            pathname + "?" + createQueryString("step", "review"),
            { scroll: false }
          )
          setIsLoading(false)
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : String(err))
          setIsLoading(false)
        },
      }
    )
  }

  return (
    <Button
      className="mt-6"
      onPress={handleSubmit}
      isLoading={isLoading}
      isDisabled={!selectedPaymentMethod || isLoading}
      data-testid="submit-payment-button"
    >
      Continue to review
    </Button>
  )
}

export default PaymentCardButton
