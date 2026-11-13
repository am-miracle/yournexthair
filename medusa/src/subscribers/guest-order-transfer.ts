import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { requestOrderTransferWorkflow } from "@medusajs/medusa/core-flows"

const MAX_ORDERS = 20

type GuestOrder = {
  id: string
  display_id: number
  email: string | null
  status: string
  created_at: string | Date
  currency_code: string
  total: number
  customer: { id: string; has_account: boolean } | null
  shipping_address: { country_code: string | null } | null
}

type TransferChange = {
  order_id: string
  actions: { action: string; reference_id: string; details: { token?: unknown } | null }[] | null
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)

// Medusa's transfer flow requires the original order email to approve via a one-time token,
// so signing up with someone else's address never exposes their orders.
export default async function requestGuestOrderTransfers({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "has_account"],
    filters: { id: data.id },
  })
  const customer = customers[0]
  if (!customer?.has_account || !customer.email) return

  const storefrontUrl = process.env.STOREFRONT_URL?.replace(/\/+$/, "")
  if (!storefrontUrl) {
    logger.warn("STOREFRONT_URL is not set; skipping guest order transfer for new customer.")
    return
  }

  const email = customer.email.toLowerCase()
  const { data: candidates } = (await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "status", "created_at", "currency_code", "total", "customer.id", "customer.has_account", "shipping_address.country_code"],
    filters: { email: { $ilike: escapeLike(email) } },
  })) as unknown as { data: GuestOrder[] }

  const guestOrders = candidates
    .filter((order) => order.email?.toLowerCase() === email && order.status !== "canceled" && order.customer?.has_account !== true)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_ORDERS)
  if (!guestOrders.length) return

  for (const order of guestOrders) {
    try {
      await requestOrderTransferWorkflow(container).run({
        input: {
          order_id: order.id,
          customer_id: customer.id,
          logged_in_user: customer.id,
          description: "Requested automatically at account sign-up",
        },
      })
    } catch (error) {
      logger.warn(`Could not request transfer of order ${order.id} to ${customer.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const { data: changes } = (await query.graph({
    entity: "order_change",
    fields: ["order_id", "actions.action", "actions.reference_id", "actions.details"],
    filters: { order_id: guestOrders.map((order) => order.id), status: "requested", change_type: "transfer" },
  })) as unknown as { data: TransferChange[] }

  const tokens = new Map<string, string>()
  for (const change of changes) {
    const action = change.actions?.find((entry) => entry.action === "TRANSFER_CUSTOMER" && entry.reference_id === customer.id)
    const token = action?.details?.token
    if (typeof token === "string" && token) tokens.set(change.order_id, token)
  }
  const claimable = guestOrders.filter((order) => tokens.has(order.id))
  if (!claimable.length) return

  // Tokens go in the fragment so they never reach server logs, analytics or Referer headers.
  const countryCode = claimable[0]?.shipping_address?.country_code?.toLowerCase() || "ng"
  const fragment = claimable.map((order) => `${order.id}.${tokens.get(order.id)}`).join(",")
  const notification = container.resolve(Modules.NOTIFICATION)
  await notification.createNotifications({
    to: customer.email,
    channel: "email",
    template: "order-transfer",
    data: {
      customer: { first_name: customer.first_name ?? null },
      orders: claimable.map((order) => ({
        display_id: order.display_id,
        created_at: new Date(order.created_at).toISOString(),
        currency_code: order.currency_code,
        total: Number(order.total),
      })),
      claim_url: `${storefrontUrl}/${countryCode}/claim-orders#c=${fragment}`,
    },
  })
  logger.info(`Requested transfer of ${claimable.length} guest order(s) to customer ${customer.id}.`)
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
