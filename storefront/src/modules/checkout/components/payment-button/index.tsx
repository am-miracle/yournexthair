"use client"

import React, { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { useRouter } from "next/navigation"

import { isFlutterwave, isManual, isPaystack } from "@lib/constants"
import { getCheckoutPaymentSession, getReviewPaymentSession } from "@lib/util/payment-session"
import { withDefinedProp } from "@lib/util/optional-props"
import { Button } from "@/components/Button"
import ErrorMessage from "@modules/checkout/components/error-message"
import { recordFlutterwaveTransaction } from "@lib/data/cart"
import { usePlaceOrder } from "hooks/cart"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  selectPaymentMethod: () => void
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  selectPaymentMethod,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = getReviewPaymentSession(
    cart.payment_collection?.payment_sessions
  )

  if (paymentSession?.status === "authorized") {
    return <AuthorizedPaymentButton notReady={notReady} />
  }

  switch (true) {
    case isFlutterwave(paymentSession?.provider_id):
      return (
        <FlutterwavePaymentButton notReady={notReady} cart={cart} />
      )
    case isPaystack(paymentSession?.provider_id):
      return (
        <PaystackPaymentButton notReady={notReady} cart={cart} />
      )
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
    setErrorMessage: (v: string | null) => void
  ) => {
    placeOrder.mutate(null, {
      onSuccess: (data) => {
        if (data?.type === "order") {
          const countryCode =
            data.order.shipping_address?.country_code?.toLowerCase()
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

// --------------------------------------------------------------------------
// Flutterwave inline popup
// --------------------------------------------------------------------------

const FlutterwavePaymentButton = ({
  cart,
  notReady,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const completeOrder = useCompleteOrder()

  const paymentSession = getCheckoutPaymentSession(
    cart.payment_collection?.payment_sessions,
    "pp_flutterwave_flutterwave"
  )

  const handlePayment = () => {
    if (!paymentSession?.data?.tx_ref) {
      setErrorMessage("Payment session not initialised. Please try again.")
      return
    }

    if (typeof window.FlutterwaveCheckout !== "function") {
      setErrorMessage("Payment provider failed to load. Please refresh and try again.")
      return
    }

    const sessionData = paymentSession.data as {
      tx_ref: string
      amount: number
      currency: string
      customer_email: string | null
    }

    setSubmitting(true)

    window.FlutterwaveCheckout({
      public_key: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY!,
      tx_ref: sessionData.tx_ref,
      // Flutterwave expects main currency unit (not smallest unit)
      amount: sessionData.amount / 100,
      currency: sessionData.currency,
      customer: {
        email: sessionData.customer_email ?? cart.email ?? "",
        ...([cart.billing_address?.first_name, cart.billing_address?.last_name]
          .filter(Boolean)
          .join(" ")
          ? {
              name: [cart.billing_address?.first_name, cart.billing_address?.last_name]
                .filter(Boolean)
                .join(" "),
            }
          : {}),
      },
      meta: {
        payment_session_id: paymentSession.id,
        cart_id: cart.id,
      },
      customizations: {
        title: "YourNextHair",
        description: "Hair purchase",
      },
      callback: async (data) => {
        if (data.status !== "successful") {
          setErrorMessage("Payment was not successful. Please try again.")
          setSubmitting(false)
          return
        }

        try {
          const result = await recordFlutterwaveTransaction(
            paymentSession.id,
            data.transaction_id,
            data.tx_ref
          )
          if (!result?.success) {
            setErrorMessage(result?.error ?? "Payment verification failed.")
            setSubmitting(false)
            return
          }
        } catch {
          setErrorMessage("Could not verify payment. Please contact support.")
          setSubmitting(false)
          return
        }

        completeOrder(setSubmitting, setErrorMessage)
      },
      onclose: () => {
        // User dismissed the popup without paying
        setSubmitting(false)
      },
    })
  }

  return (
    <>
      <Button
        isDisabled={notReady || submitting}
        onPress={handlePayment}
        isLoading={submitting}
        className="w-full"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage {...withDefinedProp("error", errorMessage)} />
    </>
  )
}

// --------------------------------------------------------------------------
// Paystack inline popup
// --------------------------------------------------------------------------

const PaystackPaymentButton = ({
  cart,
  notReady,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const completeOrder = useCompleteOrder()

  const paymentSession = getCheckoutPaymentSession(
    cart.payment_collection?.payment_sessions,
    "pp_paystack_paystack"
  )

  const handlePayment = () => {
    if (!paymentSession?.data?.paystackTxAccessCode) {
      setErrorMessage("Payment session not initialised. Please try again.")
      return
    }

    if (typeof window.PaystackPop !== "function") {
      setErrorMessage("Payment provider failed to load. Please refresh and try again.")
      return
    }

    setSubmitting(true)

    const popup = new window.PaystackPop()
    popup.resumeTransaction(
      paymentSession.data.paystackTxAccessCode as string,
      {
        onSuccess: () => {
          // The reference is already stored in the session from initiation.
          // authorizePayment() on cart.complete() verifies it server-side.
          completeOrder(setSubmitting, setErrorMessage)
        },
        onCancel: () => {
          setSubmitting(false)
        },
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Payment provider failed to load. Please try again."
          setErrorMessage(message)
          setSubmitting(false)
        },
      }
    )
  }

  return (
    <>
      <Button
        isDisabled={notReady || submitting}
        onPress={handlePayment}
        isLoading={submitting}
        className="w-full"
        data-testid="submit-order-button"
      >
        Place order
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
          const countryCode =
            data.order.shipping_address?.country_code?.toLowerCase()
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
