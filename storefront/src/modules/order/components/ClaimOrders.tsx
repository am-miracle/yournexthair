"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/Button"
import { LocalizedButtonLink, LocalizedLink } from "@/components/LocalizedLink"
import { acceptOrderTransfer } from "@lib/data/orders"
import { parseClaimFragment } from "@lib/util/claim-orders"

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

type Result = { added: number; failed: number }

// Accepting needs an explicit click: email security scanners open links automatically.
export const ClaimOrders = () => {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => null)
  const claims = useMemo(() => (hash === null ? null : parseClaimFragment(hash)), [hash])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const accept = async () => {
    if (!claims?.length) return
    setSubmitting(true)
    const outcomes = await Promise.all(claims.map((claim) => acceptOrderTransfer(claim.orderId, claim.token)))
    const added = outcomes.filter((outcome) => outcome.ok).length
    window.history.replaceState(null, "", window.location.pathname)
    setResult({ added, failed: outcomes.length - added })
    setSubmitting(false)
  }

  if (result) {
    const noun = (count: number) => (count === 1 ? "order" : "orders")
    return (
      <div className="flex flex-col gap-6" role="status" aria-live="polite">
        <h1 className="text-md md:text-2xl">
          {result.added > 0
            ? `${result.added} ${noun(result.added)} added to your account`
            : "We couldn’t add these orders"}
        </h1>
        {result.failed > 0 && (
          <p className="text-grayscale-500">
            {result.failed} {noun(result.failed)} couldn’t be added. {result.failed === 1 ? "It" : "They"} may
            already be in your account, or this link has already been used.
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <LocalizedButtonLink href="/account/my-orders">View my orders</LocalizedButtonLink>
        </div>
      </div>
    )
  }

  if (claims === null) {
    return <p role="status">Loading…</p>
  }

  if (!claims.length) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-md md:text-2xl">This link is incomplete</h1>
        <p className="text-grayscale-500">
          Open the link from your email again. If it still doesn’t work, please contact us and we’ll
          add your past orders for you.
        </p>
        <LocalizedLink href="/" className="underline">
          Continue shopping
        </LocalizedLink>
      </div>
    )
  }

  const count = claims.length
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-md md:text-2xl">Add your past {count === 1 ? "order" : "orders"} to your account</h1>
      <p className="text-grayscale-500">
        We found {count} {count === 1 ? "order" : "orders"} placed with your email address before you
        created your account. Add {count === 1 ? "it" : "them"} to see {count === 1 ? "it" : "them"} in
        your order history.
      </p>
      <div>
        <Button onPress={() => void accept()} isLoading={submitting} isDisabled={submitting}>
          Add {count === 1 ? "it" : "them"} to my account
        </Button>
      </div>
    </div>
  )
}
