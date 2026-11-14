"use client"

import React, { useState } from "react"
import * as Sentry from "@sentry/nextjs"
import { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"

import { preparePaymentReturn } from "@lib/data/payment-return"
import { isBachs, isManual } from "@lib/constants"
import { getCheckoutPaymentSession, getReviewPaymentSession } from "@lib/util/payment-session"
import { withDefinedProp } from "@lib/util/optional-props"
import { Button } from "@/components/Button"
import ErrorMessage from "@modules/checkout/components/error-message"
import { useInitiatePaymentSession, usePlaceOrder } from "hooks/cart"

const BACHS_PROVIDER_ID = "pp_bachs_bachs"

const isExpired = (expiresAt: unknown) =>
  typeof expiresAt === "string" && Date.parse(expiresAt) <= Date.now()

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  selectPaymentMethod: () => void
}

const PaymentButton: React.FC<PaymentButtonProps> = ({ cart, selectPaymentMethod }) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = getReviewPaymentSession(cart.payment_collection?.payment_sessions)

  if (paymentSession?.status === "authorized") {
    return <AuthorizedPaymentButton notReady={notReady} />
  }

  switch (true) {
    case isBachs(paymentSession?.provider_id):
      return <BachsPaymentButton notReady={notReady} cart={cart} />
    case isManual(paymentSession?.provider_id):
      return <ManualTestPaymentButton notReady={notReady} />
    default:
      return (
        <Button className="w-full" onPress={selectPaymentMethod}>
          Select a payment method
        </Button>
      )
  }
}

// --------------------------------------------------------------------------
// Shared order completion
// --------------------------------------------------------------------------

function useCompleteOrder() {
  const placeOrder = usePlaceOrder()
  const router = useRouter()

  const complete = (
    setSubmitting: (v: boolean) => void,
    setErrorMessage: (v: string | null) => void,
  ) => {
    placeOrder.mutate(null, {
      onSuccess: (data) => {
        if (data?.type === "order") {
          const countryCode = data.order.shipping_address?.country_code?.toLowerCase()
          router.push(`/${countryCode}/order/confirmed/${data.order.id}`)
        } else if (data?.error) {
          setErrorMessage(data.error.message)
        }
        setSubmitting(false)
      },
      onError: (error) => {
        setErrorMessage(error.message)
        setSubmitting(false)
      },
    })
  }

  return complete
}

const BachsPaymentButton = ({
  cart,
  notReady,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const initiatePaymentSession = useInitiatePaymentSession()

  const paymentSession = getCheckoutPaymentSession(
    cart.payment_collection?.payment_sessions,
    BACHS_PROVIDER_ID,
  )

  const getCheckoutUrl = async () => {
    if (paymentSession && !isExpired(paymentSession.data?.expires_at)) {
      return paymentSession.data?.checkout_url
    }

    const { payment_collection } = await initiatePaymentSession.mutateAsync({
      providerId: BACHS_PROVIDER_ID,
    })

    return getCheckoutPaymentSession(payment_collection?.payment_sessions, BACHS_PROVIDER_ID)?.data
      ?.checkout_url
  }

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const checkoutUrl = await getCheckoutUrl()

      if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
        setErrorMessage("Payment session not initialised. Please try again.")
        setSubmitting(false)
        return
      }

      await preparePaymentReturn()
      window.location.assign(checkoutUrl)
    } catch (error) {
      Sentry.captureException(error, { tags: { provider: "bachs", stage: "start_payment" } })
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start payment. Please try again.",
      )
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        isDisabled={notReady || submitting}
        onPress={() => void handlePayment()}
        isLoading={submitting}
        className="w-full"
        data-testid="submit-order-button"
      >
        Pay and place order
      </Button>
      <ErrorMessage {...withDefinedProp("error", errorMessage)} />
    </>
  )
}

// --------------------------------------------------------------------------
// Manual test button (dev only)
// --------------------------------------------------------------------------

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const placeOrder = usePlaceOrder()
  const router = useRouter()

  const handlePayment = () => {
    placeOrder.mutate(null, {
      onSuccess: (data) => {
        if (data?.type === "order") {
          const countryCode = data.order.shipping_address?.country_code?.toLowerCase()
          router.push(`/${countryCode}/order/confirmed/${data.order.id}`)
        } else if (data?.error) {
          setErrorMessage(data.error.message)
        }
      },
      onError: (error) => setErrorMessage(error.message),
    })
  }

  return (
    <>
      <Button
        isDisabled={notReady}
        isLoading={placeOrder.isPending}
        onPress={handlePayment}
        className="w-full"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage {...withDefinedProp("error", errorMessage)} />
    </>
  )
}

const AuthorizedPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const completeOrder = useCompleteOrder()
  const [submitting, setSubmitting] = useState(false)

  return (
    <>
      <Button
        isDisabled={notReady || submitting}
        isLoading={submitting}
        onPress={() => completeOrder(setSubmitting, setErrorMessage)}
        className="w-full"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage {...withDefinedProp("error", errorMessage)} />
    </>
  )
}

export default PaymentButton
