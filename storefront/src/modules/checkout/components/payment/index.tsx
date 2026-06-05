"use client"

import { useCallback, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { twJoin } from "tailwind-merge"

import { paymentInfoMap } from "@lib/constants"
import { getReviewPaymentSession } from "@lib/util/payment-session"
import PaymentContainer from "@modules/checkout/components/payment-container"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentCardButton from "@modules/checkout/components/payment-card-button"

import { Button } from "@/components/Button"
import { UiRadioGroup } from "@/components/ui/Radio"
import { useCartPaymentMethods } from "hooks/cart"
import { StoreCart } from "@medusajs/types"

const Payment = ({ cart }: { cart: StoreCart }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen)
    setError(null)
  }

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    getReviewPaymentSession(cart?.payment_collection?.payment_sessions)?.provider_id ?? ""
  )
  const { data: availablePaymentMethods } = useCartPaymentMethods(
    cart?.region?.id ?? ""
  )
  const currentPaymentMethod =
    selectedPaymentMethod ||
    getReviewPaymentSession(cart?.payment_collection?.payment_sessions)?.provider_id ||
    availablePaymentMethods?.[0]?.id ||
    ""
  const activeSession = isOpen
    ? getReviewPaymentSession(
        cart?.payment_collection?.payment_sessions,
        currentPaymentMethod
      )
    : getReviewPaymentSession(cart?.payment_collection?.payment_sessions)

  const paymentReady =
    activeSession &&
    cart?.shipping_methods &&
    cart?.shipping_methods.length !== 0

  if (!cart) {
    return null
  }

  return (
    <>
      <div className="flex justify-between mb-6 md:mb-8 border-t border-grayscale-200 pt-8 mt-8">
        <div>
          <h2
            className={twJoin(
              "transition-[font-weight] duration-75",
              isOpen && "font-semibold"
            )}
          >
            4. Payment
          </h2>
        </div>
        {!isOpen && paymentReady && (
          <Button
            variant="link"
            onPress={handleEdit}
            data-testid="edit-payment-button"
          >
            Change
          </Button>
        )}
      </div>

      <div className={isOpen ? "block" : "hidden"}>
        {availablePaymentMethods?.length && (
          <UiRadioGroup
            value={currentPaymentMethod || null}
            onChange={setSelectedPaymentMethod}
            aria-label="Payment methods"
          >
            {availablePaymentMethods
              .sort((a, b) => (a.id > b.id ? 1 : -1))
              .map((paymentMethod) => (
                <PaymentContainer
                  paymentInfoMap={paymentInfoMap}
                  paymentProviderId={paymentMethod.id}
                  key={paymentMethod.id}
                />
              ))}
          </UiRadioGroup>
        )}

        <ErrorMessage
          error={error}
          data-testid="payment-method-error-message"
        />

        <PaymentCardButton
          setError={setError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          selectedPaymentMethod={currentPaymentMethod}
          createQueryString={createQueryString}
          cart={cart}
        />
      </div>

      <div className={isOpen ? "hidden" : "block"}>
        {cart && paymentReady && activeSession ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 md:grid-cols-[minmax(0,10rem)_1fr] md:gap-4">
              <div
                className="text-grayscale-500"
                data-testid="payment-method-summary"
              >
                Payment method
              </div>
              <div className="text-grayscale-600">
                {paymentInfoMap[activeSession.provider_id]?.title ||
                  activeSession.provider_id}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,10rem)_1fr] md:gap-4">
              <div
                className="text-grayscale-500"
                data-testid="payment-details-summary"
              >
                Payment details
              </div>
              <div className="text-grayscale-600">
                Payment will be confirmed after you place the order.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default Payment
