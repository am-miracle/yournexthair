import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.payment_sessions.id", "payment_collections.payment_sessions.provider_id",
      "payment_collections.payment_sessions.metadata", "payment_collections.payment_sessions.status"],
    filters: { id: req.params.id! },
  })
  const order = orders[0]
  if (!order) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  const sessions = (order.payment_collections ?? []).flatMap((collection) => collection?.payment_sessions ?? [])
    .filter((session) => session?.provider_id === "pp_bachs_bachs")
    .map((session) => ({
      id: session!.id,
      payment_status: ["authorized", "captured"].includes(session!.status)
        ? "paid" : session!.metadata?.bachs_payment_status ?? null,
      refunds: Object.values((session!.metadata?.bachs_refunds ?? {}) as Record<string, unknown>),
    }))
  res.json({ sessions })
}
