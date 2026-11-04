"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as Sentry from "@sentry/nextjs"

import { Button } from "@/components/Button"
import { LocalizedLink } from "@/components/LocalizedLink"
import { withDefinedProp } from "@lib/util/optional-props"
import ErrorMessage from "@modules/checkout/components/error-message"
import { usePlaceOrder } from "hooks/cart"

const MAX_ATTEMPTS = 4
const RETRY_DELAY_MS = 3000

type Status = "confirming" | "pending" | "failed"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const BachsReturn = ({ countryCode }: { countryCode: string }) => {
  const router = useRouter()
  const { mutateAsync: placeOrder } = usePlaceOrder()
  const [status, setStatus] = useState<Status>("confirming")
  const [message, setMessage] = useState<string | null>(null)
  const started = useRef(false)

  const confirm = useCallback(async () => {
    setStatus("confirming")

    // Bachs can redirect before the payment settles; the webhook still completes the order later.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await placeOrder(null)

        // placeOrder redirects to the confirmation page once the order exists.
        if (!result) {
          return
        }

        if (result.type === "order") {
          const orderCountry =
            result.order.shipping_address?.country_code?.toLowerCase() ?? countryCode
          router.replace(`/${orderCountry}/order/confirmed/${result.order.id}`)
          return
        }

        setMessage(result?.error?.message ?? null)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : null)
      }

      if (attempt < MAX_ATTEMPTS) {
        await wait(RETRY_DELAY_MS)
      }
    }

    Sentry.captureMessage("Bachs payment not confirmed after return", {
      level: "warning",
      tags: { provider: "bachs", stage: "return" },
    })
    setStatus("pending")
  }, [countryCode, placeOrder, router])

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    confirm().catch(() => setStatus("failed"))
  }, [confirm])

  if (status === "confirming") {
    return (
      <div className="flex flex-col gap-4" role="status" aria-live="polite">
        <h1 className="text-md font-semibold">Confirming your payment…</h1>
        <p className="text-grayscale-500">
          Please keep this page open while we confirm your payment with Bachs.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6" role="alert">
      <div className="flex flex-col gap-2">
        <h1 className="text-md font-semibold">
          {status === "pending"
            ? "We’re still confirming your payment"
            : "We couldn’t confirm your payment"}
        </h1>
        <p className="text-grayscale-500">
          If you completed the payment, your order will be created automatically
          and you’ll receive a confirmation email. You won’t be charged twice.
        </p>
        <ErrorMessage {...withDefinedProp("error", message)} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Button onPress={() => void confirm().catch(() => setStatus("failed"))}>
          Check again
        </Button>
        <LocalizedLink href="/checkout?step=review">
          <Button variant="outline">Back to checkout</Button>
        </LocalizedLink>
      </div>
    </div>
  )
}

export default BachsReturn
