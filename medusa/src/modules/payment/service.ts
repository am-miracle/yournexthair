import { timingSafeEqual } from "crypto"
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
  PaymentSessionStatus,
} from "@medusajs/types"
import {
  assertSuccessfulVerification,
  type FlutterwaveSessionData,
  verifyFlutterwaveTransaction,
} from "./verification"

type FlutterwaveOptions = {
  secret_key: string
  public_key: string
  webhook_secret: string
}

type SessionData = FlutterwaveSessionData & {
  customer_email: string | null
  transaction_id?: number
}

type FlutterwaveWebhookEvent = {
  event?: string
  data?: {
    tx_ref?: string
    status?: string
    id?: number
    amount?: number
    charged_amount?: number
    currency?: string
    meta?: Record<string, unknown> | string | null
  }
}

type WebhookMeta = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const parseMeta = (
  meta: Record<string, unknown> | string | null | undefined
): WebhookMeta => {
  if (!meta) {
    return {}
  }

  if (typeof meta === "string") {
    try {
      const parsed: unknown = JSON.parse(meta)
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  return isRecord(meta) ? meta : {}
}

export class FlutterwavePaymentService extends AbstractPaymentProvider<FlutterwaveOptions> {
  static identifier = "flutterwave"

  constructor(container: Record<string, unknown>, config: FlutterwaveOptions) {
    super(container, config)
  }

  private get secretKey(): string {
    return this.config.secret_key
  }

  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, context } = input

    // Use customer ID or idempotency key for a stable, unique tx_ref
    const base = context?.idempotency_key ?? context?.customer?.id ?? String(Date.now())
    const tx_ref = `ynh-${base.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}-${Date.now()}`

    const sessionData: SessionData = {
      tx_ref,
      amount: Number(amount),
      currency: currency_code.toUpperCase(),
      customer_email: context?.customer?.email ?? null,
    }

    return Promise.resolve({ id: tx_ref, data: sessionData })
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const sessionData = (input.data ?? {}) as SessionData

    if (!sessionData.transaction_id) {
      return { status: "pending" as PaymentSessionStatus, data: sessionData }
    }

    try {
      const verification = await verifyFlutterwaveTransaction(
        sessionData.transaction_id,
        this.secretKey,
      )
      const verifiedTransaction = assertSuccessfulVerification(verification, sessionData)

      return {
        status: "authorized" as PaymentSessionStatus,
        data: { ...sessionData, flw_transaction: verifiedTransaction },
      }
    } catch (e) {
      return {
        status: "error" as PaymentSessionStatus,
        data: { ...sessionData, error: (e as Error).message },
      }
    }
  }

  capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // Flutterwave auto-captures on successful charge — no API call needed
    return Promise.resolve({ data: { ...((_input.data ?? {}) as SessionData), captured: true } })
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const sessionData = (input.data ?? {}) as SessionData

    if (!sessionData.transaction_id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Cannot refund: no transaction ID on payment"
      )
    }

    const refundAmount = Number(input.amount)

    if (refundAmount <= 0 || refundAmount > sessionData.amount) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid refund amount: ${refundAmount}. Must be between 1 and ${sessionData.amount}.`
      )
    }

    const body: Record<string, unknown> = {}
    // Omit amount for full refund; include for partial
    if (refundAmount < sessionData.amount) {
      body.amount = refundAmount / 100
    }

    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${sessionData.transaction_id}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Flutterwave refund failed: ${errText}`
      )
    }

    const refundBody: unknown = await res.json()
    const refundData = refundBody as { data?: { id: number } }
    return { data: { ...sessionData, refund_id: refundData.data?.id } }
  }

  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Flutterwave Inline has no cancel API — the popup was just closed without payment
    return Promise.resolve({ data: { ...(input.data ?? {}), cancelled: true } })
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const sessionData = (input.data ?? {}) as SessionData
    if (!sessionData.transaction_id) {
      return { data: sessionData }
    }
    try {
      const verification = await verifyFlutterwaveTransaction(
        sessionData.transaction_id,
        this.secretKey,
      )
      return { data: { ...sessionData, flw_transaction: verification.data } }
    } catch {
      return { data: sessionData }
    }
  }

  updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const sessionData = (input.data ?? {}) as SessionData
    const newAmount = Number(input.amount)
    const newCurrency = input.currency_code.toUpperCase()

    if (sessionData.amount !== newAmount || sessionData.currency !== newCurrency) {
      // Amount or currency changed — generate a new tx_ref so the popup uses the right values
      const base = sessionData.tx_ref.split("-").slice(0, 2).join("-")
      const tx_ref = `${base}-${Date.now()}`
      return Promise.resolve({
        data: {
          ...sessionData,
          tx_ref,
          amount: newAmount,
          currency: newCurrency,
          transaction_id: undefined,
        },
      })
    }

    return Promise.resolve({ data: sessionData })
  }

  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: (input.data ?? {}) })
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const sessionData = (input.data ?? {}) as SessionData

    if (!sessionData.transaction_id) {
      return { status: "pending" as PaymentSessionStatus }
    }

    try {
      const verification = await verifyFlutterwaveTransaction(
        sessionData.transaction_id,
        this.secretKey,
      )
      if (verification.data.status === "successful") {
        return { status: "authorized" as PaymentSessionStatus }
      }
      return { status: "pending" as PaymentSessionStatus }
    } catch {
      return { status: "error" as PaymentSessionStatus }
    }
  }

  getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const hash = webhookData.headers?.["verif-hash"] as string | undefined

    const expected = this.config.webhook_secret
    const isValid =
      hash &&
      hash.length === expected.length &&
      timingSafeEqual(Buffer.from(hash), Buffer.from(expected))

    if (!isValid) {
      return Promise.reject(
        new MedusaError(
          MedusaError.Types.UNAUTHORIZED,
          "Invalid Flutterwave webhook signature"
        )
      )
    }

    const event = webhookData.data as FlutterwaveWebhookEvent

    const txRef = event.data?.tx_ref
    const transactionId = event.data?.id

    if (!txRef || !transactionId) {
      return Promise.resolve({ action: "not_supported" as const })
    }

    const meta = parseMeta(event.data?.meta ?? null)
    const paymentSessionId = meta["payment_session_id"]
    const sessionId = typeof paymentSessionId === "string" ? paymentSessionId : ""

    if (!sessionId) {
      return Promise.resolve({ action: "not_supported" as const })
    }

    const amount = Number(event.data?.charged_amount ?? event.data?.amount ?? 0)

    if (event.data?.status !== "successful") {
      return Promise.resolve({
        action: "failed" as const,
        data: { session_id: sessionId, amount },
      })
    }

    return Promise.resolve({
      action: "authorized" as const,
      data: { session_id: sessionId, amount },
    })
  }
}

export default FlutterwavePaymentService
