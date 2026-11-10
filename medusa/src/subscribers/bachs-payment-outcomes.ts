import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import type { ProviderWebhookPayload } from "@medusajs/framework/types"
import { Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import * as Sentry from "@sentry/node"
import { BachsClient, resolveBachsBaseUrl } from "../modules/bachs/client"
import { reconcileBachsWebhook } from "../modules/bachs/reconcile"

export default async function bachsPaymentOutcomes({ event, container }: SubscriberArgs<ProviderWebhookPayload>) {
  if (event.data.provider !== "bachs_bachs") return
  const key = process.env.BACHS_SECRET_KEY
  const secret = process.env.BACHS_WEBHOOK_SECRET
  if (!key || !secret) throw new Error("Bachs webhook credentials are missing")
  const locking = container.resolve(Modules.LOCKING)
  try {
    await reconcileBachsWebhook({
      payload: event.data.payload, secret,
      client: new BachsClient(key, resolveBachsBaseUrl(key, process.env.BACHS_API_URL)),
      payments: container.resolve(Modules.PAYMENT), logger: container.resolve("logger"),
      withLock: (key, job) => locking.execute(key, job),
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { provider: "bachs", stage: "reconcile-webhook" } })
    throw error // Let the event bus retry transient API/database failures.
  }
}

export const config: SubscriberConfig = {
  event: PaymentWebhookEvents.WebhookReceived,
  context: { subscriberId: "bachs-payment-outcomes" },
}
