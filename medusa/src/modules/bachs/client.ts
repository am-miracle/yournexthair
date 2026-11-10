import { MedusaError } from "@medusajs/framework/utils"

export const BACHS_SANDBOX_URL = "https://sandbox-api.bachs.io"
export const BACHS_LIVE_URL = "https://api.bachs.io"

export type BachsCharge = {
  payment_id?: string | null
  checkout_id?: string | null
  status?: string
  amount?: string
  amount_paid?: string | null
  currency?: string
}

export type BachsCheckoutSession = {
  checkout_id: string
  status: string
  payment_status?: string | null
  amount: string
  currency: string
  reference?: string | null
  charge?: BachsCharge | null
  metadata?: Record<string, unknown> | null
  expires_at?: string | null
}

export type BachsCreatedCheckout = {
  checkout_id: string
  checkout_url: string
  status?: string
  expires_at?: string | null
}

export type BachsRefund = {
  refund_id?: string
  charge_id?: string
  status?: string
  requested_amount?: string
  refunded_amount?: string | null
}

export type CreateCheckoutSessionBody = {
  pricing: { currency: string; amount: string }
  customer: { email: string; name: string; phone_number?: string }
  reference: string
  metadata: Record<string, unknown>
  success_url: string
  cancel_url: string
}

export type CreateRefundBody = {
  charge_id: string
  reference: string
  amount?: string
  reason?: string
}

export const resolveBachsBaseUrl = (apiKey: string, override?: string) => {
  if (override) {
    return override.replace(/\/+$/, "")
  }

  return apiKey.startsWith("sk_live_") ? BACHS_LIVE_URL : BACHS_SANDBOX_URL
}

export class BachsClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  createCheckoutSession(body: CreateCheckoutSessionBody, idempotencyKey: string) {
    return this.request<BachsCreatedCheckout>("POST", "/v1/checkout-sessions", body, idempotencyKey)
  }

  getCheckoutSession(checkoutId: string) {
    return this.request<BachsCheckoutSession>(
      "GET",
      `/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
    )
  }

  getPayment(paymentId: string) {
    return this.request<BachsCharge>("GET", `/v1/payments/${encodeURIComponent(paymentId)}`)
  }

  getRefund(refundId: string) {
    return this.request<BachsRefund>("GET", `/v1/refunds/${encodeURIComponent(refundId)}`)
  }

  createRefund(body: CreateRefundBody, idempotencyKey: string) {
    return this.request<BachsRefund>("POST", "/v1/refunds", body, idempotencyKey)
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey
    }

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Could not reach Bachs (${method} ${path}): ${(error as Error).message}`,
      )
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new MedusaError(
        res.status >= 500 ? MedusaError.Types.UNEXPECTED_STATE : MedusaError.Types.INVALID_DATA,
        `Bachs ${method} ${path} failed with HTTP ${res.status}: ${detail.slice(0, 500)}`,
      )
    }

    return (await res.json()) as T
  }
}
