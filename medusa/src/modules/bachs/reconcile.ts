import type { IPaymentModuleService, Logger, ProviderWebhookPayload } from "@medusajs/framework/types"
import { MathBN, PaymentSessionStatus } from "@medusajs/framework/utils"
import type { BachsClient } from "./client"
import { verifiedBachsEvent } from "./webhook"

export const BACHS_RECONCILIATION_EVENTS = new Set([
  "collection.failed", "collection.underpaid", "checkout.expired",
  "refund.created", "refund.paid", "refund.failed",
])

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

export async function reconcileBachsWebhook({
  payload, secret, client, payments, logger, withLock,
}: {
  payload: ProviderWebhookPayload["payload"]
  secret: string
  client: BachsClient
  payments: IPaymentModuleService
  logger: Pick<Logger, "warn" | "error">
  withLock: (key: string, job: () => Promise<void>) => Promise<void>
}): Promise<void> {
  const event = verifiedBachsEvent(payload, secret)
  if (!event || !BACHS_RECONCILIATION_EVENTS.has(event.type)) return

  const isRefund = event.type.startsWith("refund.")
  const refundId = text(event.data.refund_id) ?? (isRefund ? text(event.data.id) : undefined)
  if (isRefund && !refundId) throw new Error("Bachs refund webhook is missing its refund ID")
  // Re-fetch authoritative state so delayed/out-of-order deliveries cannot roll it back.
  const refund = refundId ? await client.getRefund(refundId) : undefined
  if (refund && refund.refund_id !== refundId) throw new Error("Bachs refund ID mismatch")
  const chargeId = text(refund?.charge_id) ?? text(event.data.payment_id) ?? text(event.data.charge_id)
  let checkoutId = isRefund ? undefined : text(event.data.checkout_id)
  if (!checkoutId && !isRefund) {
    const nested = [event.data.checkout, event.data.charge, event.data.object]
    for (const value of nested) {
      if (value && typeof value === "object") {
        checkoutId = text((value as Record<string, unknown>).checkout_id)
        if (checkoutId) break
      }
    }
    const id = text(event.data.id)
    if (!checkoutId && id?.startsWith("chk_")) checkoutId = id
  }
  if (!checkoutId && chargeId) checkoutId = text((await client.getPayment(chargeId)).checkout_id)
  if (!checkoutId) throw new Error(`Bachs ${event.type} cannot be matched to a checkout`)

  const checkout = await client.getCheckoutSession(checkoutId)
  const sessionId = text(checkout.metadata?.session_id)
  if (!sessionId) {
    logger.warn(`Ignoring Bachs ${event.type}: checkout has no Medusa session`)
    return
  }

  await withLock(`bachs-session:${sessionId}`, async () => {
    const session = await payments.retrievePaymentSession(sessionId)
    const data = session.data ?? {}
    if (session.provider_id !== "pp_bachs_bachs" || data.checkout_id !== checkout.checkout_id ||
      checkout.checkout_id !== checkoutId || checkout.currency.toLowerCase() !== session.currency_code.toLowerCase() ||
      !MathBN.eq(checkout.amount, session.amount)) {
      throw new Error("Bachs webhook does not match the stored payment session")
    }
    const metadata = { ...(session.metadata ?? {}) }
    let status = session.status
    if (refund) {
      if (!chargeId || checkout.charge?.payment_id !== chargeId) throw new Error("Bachs refund charge mismatch")
      // Record provider settlement separately: Medusa creates its refund record when requested.
      // Do not issue another refund, adjust order totals, or undo that record in a webhook.
      if (!["processing", "success", "failed"].includes(refund.status ?? "")) return
      const outcome = {
        refund_id: refundId!, charge_id: chargeId, status: refund.status!,
        requested_amount: refund.requested_amount ?? null,
        refunded_amount: refund.refunded_amount ?? null,
      }
      const refunds = (metadata.bachs_refunds ?? {}) as Record<string, Record<string, unknown>>
      const previous = refunds[refundId!]
      if (previous?.refund_id === refundId && previous?.status === "success" && outcome.status !== "success") return
      if (JSON.stringify(previous) === JSON.stringify(outcome)) return
      metadata.bachs_refunds = { ...refunds, [refundId!]: outcome }
      if (refund.status === "failed") logger.error(`Bachs refund ${refundId} failed; review session ${sessionId} in Admin`)
    } else {
      // A failed attempt/expired notification must never downgrade a paid session.
      if (["authorized", "captured"].includes(session.status) ||
        checkout.payment_status === "succeeded" || checkout.charge?.status === "succeeded") return
      let state: string
      if (checkout.status === "EXPIRED" || checkout.status === "CANCELLED") {
        state = "expired"
        status = PaymentSessionStatus.CANCELED
      } else if (checkout.payment_status === "underpaid" || checkout.charge?.status === "underpaid") {
        state = "underpaid"
        status = PaymentSessionStatus.REQUIRES_MORE
      } else if (checkout.payment_status === "failed" || checkout.charge?.status === "failed") {
        state = "failed"
        status = PaymentSessionStatus.ERROR
      } else {
        // A newer retry is pending; the old event no longer describes the checkout.
        return
      }
      if (metadata.bachs_payment_status === state && session.status === status) return
      metadata.bachs_payment_status = state
    }
    await payments.updatePaymentSession({
      id: session.id, data, amount: session.amount, currency_code: session.currency_code,
      status, metadata,
    })
  })
}
