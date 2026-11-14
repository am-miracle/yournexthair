"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/Button"
import { LocalizedButtonLink, LocalizedLink } from "@/components/LocalizedLink"
import { acceptOrderTransfer } from "@lib/data/orders"
import {
  claimFragment,
  parseClaimFragment,
  preserveClaims,
  restoreClaimFragment,
  submitClaims,
} from "@lib/util/claim-orders"

const storage = () => window.sessionStorage
const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange)
  window.addEventListener("claimschange", onChange)
  return () => {
    window.removeEventListener("hashchange", onChange)
    window.removeEventListener("claimschange", onChange)
  }
}
const snapshot = () => window.location.hash || restoreClaimFragment(storage)

type Result = { added: number; failed: number; invalid: number }

// Keep confirmation explicit: email security scanners open links automatically.
export const ClaimOrders = ({
  signedIn,
  countryCode,
}: {
  signedIn: boolean
  countryCode: string
}) => {
  const hash = useSyncExternalStore(subscribe, snapshot, () => null)
  const claims = useMemo(() => (hash === null ? null : parseClaimFragment(hash)), [hash])
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const [result, setResult] = useState<Result | null>(null)
  const [authenticationRequired, setAuthenticationRequired] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const needsSignIn = !signedIn || authenticationRequired
  const loginPath = `/auth/login?redirect=${encodeURIComponent(`/${countryCode}/claim-orders`)}`

  const signIn = () => {
    if (!claims?.length) return
    if (!preserveClaims(claims, storage)) {
      setStorageFailed(true)
      return
    }
    // The return URL contains no claim credentials. The original fragment is
    // retained until we leave, so failed storage/navigation cannot destroy it.
    window.location.assign(`/${countryCode}${loginPath}`)
  }

  const accept = async () => {
    if (!claims?.length || needsSignIn || inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    preserveClaims(claims, storage)
    try {
      const outcome = await submitClaims(claims, acceptOrderTransfer)
      // Only confirmed successes are removed. Rejected requests remain retryable.
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}${claimFragment(outcome.remaining)}`,
      )
      preserveClaims(outcome.remaining, storage)
      window.dispatchEvent(new Event("claimschange"))
      setAuthenticationRequired(outcome.authenticationRequired)
      setResult((previous) => ({
        added: (previous?.added ?? 0) + outcome.added,
        failed: outcome.remaining.length,
        invalid: outcome.invalid,
      }))
    } catch {
      setResult((previous) => ({ added: previous?.added ?? 0, failed: claims.length, invalid: 0 }))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  if (claims === null) return <p role="status">Loading…</p>

  const count = claims.length
  const noun = (number: number) => (number === 1 ? "order" : "orders")
  if (!count && !result) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-md md:text-2xl">This link is incomplete</h1>
        <p className="text-grayscale-500">
          Open the link from your email again. If it still doesn’t work, please contact us for help.
        </p>
        <LocalizedLink href="/" className="underline">
          Continue shopping
        </LocalizedLink>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="status" aria-live="polite" className="flex flex-col gap-6">
        <h1 className="text-md md:text-2xl">
          {result
            ? result.added > 0
              ? `${result.added} ${noun(result.added)} added to your account`
              : "We couldn’t add these orders"
            : `Add your past ${noun(count)} to your account`}
        </h1>
        {result && result.failed > 0 && (
          <p className="text-grayscale-500">
            {result.failed} {noun(result.failed)} still need to be added. Your remaining claims have
            been kept so you can try again.
          </p>
        )}
        {result && result.invalid > 0 && (
          <p className="text-grayscale-500">
            Some claims could not be accepted. They may already be in your account, have expired, or
            belong to a different account. Check your orders or contact us if retrying does not
            help.
          </p>
        )}
        {count > 0 && needsSignIn && (
          <p className="text-grayscale-500">
            Sign in with the account this email was sent to, then return here to confirm. Your
            pending claims will be kept.
          </p>
        )}
        {storageFailed && (
          <p role="alert">
            Your browser could not save these claims. Keep this page open,{" "}
            <LocalizedLink
              href="/auth/login"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              sign in in another tab
            </LocalizedLink>
            , then reload this page and try again.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        {count > 0 &&
          (needsSignIn ? (
            <Button onPress={signIn}>Sign in and continue</Button>
          ) : (
            <Button onPress={() => void accept()} isLoading={submitting} isDisabled={submitting}>
              {result
                ? "Retry remaining orders"
                : `Add ${count === 1 ? "it" : "them"} to my account`}
            </Button>
          ))}
        {result && (
          <LocalizedButtonLink href="/account/my-orders">View my orders</LocalizedButtonLink>
        )}
      </div>
    </div>
  )
}
