"use server"

import { cache } from "react"
import { updateTag } from "next/cache"
import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders, getReceiptHeaders } from "@lib/data/cookies"
import { HttpTypes } from "@medusajs/types"
import type { ClaimResult } from "@lib/util/claim-orders"

export const retrieveOrder = cache(async (id: unknown) => {
  if (typeof id !== "string") {
    throw new Error("Invalid order id")
  }

  const order = await sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      query: {
        fields:
          "-items.variant,-items.product,*payment_collections.payments,*payment_collections.payments.captures,*payment_collections.payments.refunds,+customer_id,+fulfillment_status,+payment_status,*fulfillments,*fulfillments.labels",
      },
      cache: "no-store",
      headers: { ...(await getAuthHeaders()), ...(await getReceiptHeaders(id)) },
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))

  return order
})

export const listOrders = async function (limit: number = 10, offset: number = 0) {
  if (
    typeof limit !== "number" ||
    typeof offset !== "number" ||
    limit < 1 ||
    offset < 0 ||
    limit > 100 ||
    !Number.isSafeInteger(offset)
  ) {
    throw new Error("Invalid input data")
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "*items,+fulfillment_status,+payment_status",
      },
      next: { tags: ["orders"] },
      headers: { ...(await getAuthHeaders()) },
    })
    .catch((err) => medusaError(err))
}

export async function acceptOrderTransfer(orderId: unknown, token: unknown): Promise<ClaimResult> {
  if (
    typeof orderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    typeof token !== "string" ||
    !/^[A-Za-z0-9-]+$/.test(token)
  ) {
    return { ok: false, reason: "invalid_claim" }
  }

  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) {
    return { ok: false, reason: "authentication_required" }
  }

  try {
    // The transfer token is not a substitute for a verified customer session.
    await sdk.client.fetch("/store/customers/me", { headers, cache: "no-store" })
    await sdk.store.order.acceptTransfer(orderId, { token }, {}, headers)
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error ? error.status : undefined
    if (status === 401) return { ok: false, reason: "authentication_required" }
    if ([400, 403, 404, 409, 410, 422].includes(Number(status))) {
      return { ok: false, reason: "invalid_claim" }
    }
    return { ok: false, reason: "retryable" }
  }
  updateTag("orders")
  return { ok: true }
}
