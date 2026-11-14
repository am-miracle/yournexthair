import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  checkoutKey,
  equalCredential,
  issueReceiptToken,
  verifyReceiptToken,
} from "../../../utils/receipt-tokens"

type Next = (error?: unknown) => void

export async function authorizeReceipt(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: Next,
) {
  res.setHeader("Cache-Control", "private, no-store")
  res.setHeader("Vary", "Authorization, Cookie, X-Receipt-Token")
  try {
    const orderId = req.params.id
    if (!orderId) return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
    if (verifyReceiptToken(req.headers["x-receipt-token"], orderId)) return next()
    const customerId = req.auth_context?.actor_id
    if (customerId) {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "customer_id"],
        filters: { id: orderId, is_draft_order: false },
      })
      if (data[0]?.customer_id === customerId) return next()
    }
    return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
  } catch (error) {
    return next(error)
  }
}

export function secureCompletion(req: MedusaRequest, res: MedusaResponse, next: Next) {
  res.setHeader("Cache-Control", "private, no-store")
  try {
    if (!equalCredential(req.headers["x-storefront-checkout-key"], checkoutKey())) {
      return next(
        new MedusaError(MedusaError.Types.UNAUTHORIZED, "Checkout authorization required"),
      )
    }
    const send = res.json.bind(res)
    res.json = (body) => {
      const result = body as { type?: string; order?: { id?: string } } | undefined
      if (result?.type === "order" && typeof result.order?.id === "string") {
        return send({ ...result, receipt_token: issueReceiptToken(result.order.id) })
      }
      return send(body)
    }
    return next()
  } catch (error) {
    return next(error)
  }
}
