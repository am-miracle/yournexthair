import { StorePaymentSession } from "@medusajs/types"

const CHECKOUT_SESSION_STATUSES = new Set(["pending", "requires_more"])
const REVIEWABLE_SESSION_STATUSES = new Set(["pending", "requires_more", "authorized"])

const getPaymentSession = (
  sessions: StorePaymentSession[] | null | undefined,
  statuses: Set<string>,
  providerId?: string | null
) => {
  if (!sessions?.length) {
    return undefined
  }

  const matchingSessions = sessions.filter((session) => statuses.has(session.status))

  if (!matchingSessions.length) {
    return undefined
  }

  const forProvider = providerId
    ? matchingSessions.filter((session) => session.provider_id === providerId)
    : []

  if (forProvider.length) {
    return forProvider.at(-1)
  }

  return matchingSessions.at(-1)
}

export const getCheckoutPaymentSession = (
  sessions: StorePaymentSession[] | null | undefined,
  providerId?: string | null
) => getPaymentSession(sessions, CHECKOUT_SESSION_STATUSES, providerId)

export const getReviewPaymentSession = (
  sessions: StorePaymentSession[] | null | undefined,
  providerId?: string | null
) => getPaymentSession(sessions, REVIEWABLE_SESSION_STATUSES, providerId)
