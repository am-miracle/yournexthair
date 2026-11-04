import {
  AbstractPaymentProvider,
  MathBN,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  BigNumberInput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

import * as Sentry from "@sentry/node"

import {
  BachsClient,
  type BachsCheckoutSession,
  resolveBachsBaseUrl,
} from "./client"
import { toRawBody, verifyBachsSignature } from "./webhook"

export type BachsOptions = {
  api_key: string
  webhook_secret: string
  storefront_url: string
  base_url?: string
}

export type BachsSessionData = {
  session_id: string
  checkout_id: string
  checkout_url: string
  expires_at: string | null
  reference: string
  amount: string
  currency: string
  email: string
  customer_name: string
  country_code: string
  payment_id?: string
  refund_id?: string
  refund_status?: string
}

type InitiateData = {
  session_id?: unknown
  email?: unknown
  customer_name?: unknown
  country_code?: unknown
}

const SUCCESS_EVENTS = new Set(["collection.succeeded", "checkout.completed"])

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const toDecimalString = (amount: BigNumberInput) => MathBN.convert(amount).toFixed(2)

export class BachsPaymentService extends AbstractPaymentProvider<BachsOptions> {
  static identifier = "bachs"

  protected readonly client: BachsClient
  protected readonly logger: Logger | undefined

  static validateOptions(options: Record<string, unknown>) {
    for (const key of ["api_key", "webhook_secret", "storefront_url"]) {
      if (!asString(options[key])) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Bachs payment provider requires the "${key}" option`,
        )
      }
    }
  }

  constructor(container: { logger?: Logger }, options: BachsOptions) {
    super(container, options)
    this.logger = container.logger
    this.client = new BachsClient(
      options.api_key,
      resolveBachsBaseUrl(options.api_key, options.base_url),
    )
  }

  async initiatePayment({
    amount,
    currency_code,
    data,
    context,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const input = (data ?? {}) as InitiateData
    const sessionId = asString(input.session_id)

    if (!sessionId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing payment session id")
    }

    const email = asString(input.email) ?? context?.customer?.email
    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "An email address is required before paying with Bachs",
      )
    }

    const countryCode = asString(input.country_code)?.toLowerCase() ?? ""
    if (!/^[a-z]{2}$/.test(countryCode)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "A valid country code is required")
    }

    const sessionData = await this.createCheckout({
      session_id: sessionId,
      email,
      customer_name: asString(input.customer_name) ?? email.split("@")[0] ?? email,
      country_code: countryCode,
      amount: toDecimalString(amount),
      currency: currency_code.toUpperCase(),
    })

    return { id: sessionData.checkout_id, data: sessionData }
  }

  async updatePayment({ amount, currency_code, data }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const current = data as BachsSessionData
    const nextAmount = toDecimalString(amount)
    const nextCurrency = currency_code.toUpperCase()

    if (current.amount === nextAmount && current.currency === nextCurrency) {
      return { data: current }
    }

    const sessionData = await this.createCheckout({
      session_id: current.session_id,
      email: current.email,
      customer_name: current.customer_name,
      country_code: current.country_code,
      amount: nextAmount,
      currency: nextCurrency,
    })

    return { data: sessionData }
  }

  async authorizePayment({ data }: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const sessionData = data as BachsSessionData
    const checkout = await this.client.getCheckoutSession(sessionData.checkout_id)
    const status = this.mapStatus(checkout, sessionData)

    if (status !== PaymentSessionStatus.CAPTURED) {
      return { status, data: sessionData }
    }

    return {
      status,
      data: {
        ...sessionData,
        ...(checkout.charge?.payment_id ? { payment_id: checkout.charge.payment_id } : {}),
      },
    }
  }

  capturePayment({ data }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return Promise.resolve({ data: data ?? {} })
  }

  cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return Promise.resolve({ data: data ?? {} })
  }

  deletePayment({ data }: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: data ?? {} })
  }

  async getPaymentStatus({ data }: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const sessionData = data as BachsSessionData
    const checkout = await this.client.getCheckoutSession(sessionData.checkout_id)
    return { status: this.mapStatus(checkout, sessionData) }
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const sessionData = data as BachsSessionData
    const checkout = await this.client.getCheckoutSession(sessionData.checkout_id)
    return { data: { ...sessionData, bachs_status: checkout.status, bachs_payment_status: checkout.payment_status } }
  }

  async refundPayment({ amount, data }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const sessionData = data as BachsSessionData

    if (!sessionData.payment_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot refund: this payment has no Bachs charge id",
      )
    }

    if (sessionData.refund_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Bachs allows only one refund per charge, and refund ${sessionData.refund_id} already exists`,
      )
    }

    const refundAmount = MathBN.convert(amount)
    if (refundAmount.lte(0) || refundAmount.gt(MathBN.convert(sessionData.amount))) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Refund amount must be between 0 and ${sessionData.amount}`,
      )
    }

    const reference = `refund_${sessionData.payment_id}`
    const isPartial = refundAmount.lt(MathBN.convert(sessionData.amount))
    const refund = await this.client.createRefund(
      {
        charge_id: sessionData.payment_id,
        reference,
        ...(isPartial ? { amount: refundAmount.toFixed(2) } : {}),
      },
      reference,
    )

    return {
      data: {
        ...sessionData,
        ...(refund.refund_id ? { refund_id: refund.refund_id } : {}),
        ...(refund.status ? { refund_status: refund.status } : {}),
      },
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    try {
      return await this.resolveWebhook(payload)
    } catch (error) {
      Sentry.captureException(error, { tags: { provider: "bachs", stage: "webhook" } })
      throw error
    }
  }

  private async resolveWebhook(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    const rawBody = toRawBody(payload.rawData)
    const headers = (payload.headers ?? {}) as Record<string, string | string[] | undefined>

    if (!rawBody || !verifyBachsSignature(rawBody, headers, this.config.webhook_secret)) {
      this.logger?.warn("Rejected Bachs webhook: missing body or invalid signature")
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const event = payload.data as { type?: unknown; data?: unknown }
    const type = asString(event?.type)

    if (!type || !SUCCESS_EVENTS.has(type)) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const checkoutId = await this.findCheckoutId(isRecord(event.data) ? event.data : {})
    if (!checkoutId) {
      this.logger?.warn(`Bachs webhook ${type} did not reference a checkout`)
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // The event payload is only a trigger; the checkout fetched from the API is what gets trusted.
    const checkout = await this.client.getCheckoutSession(checkoutId)
    const sessionId = asString(checkout.metadata?.session_id)

    if (!sessionId || !this.isPaid(checkout)) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    return {
      action: PaymentActions.AUTHORIZED,
      data: { session_id: sessionId, amount: checkout.amount },
    }
  }

  private async createCheckout(
    input: Omit<BachsSessionData, "checkout_id" | "checkout_url" | "expires_at" | "reference">,
  ): Promise<BachsSessionData> {
    const reference = `${input.session_id}_${input.currency}_${input.amount}`
    const storefrontUrl = this.config.storefront_url.replace(/\/+$/, "")
    const checkout = await this.client.createCheckoutSession(
      {
        pricing: { currency: input.currency, amount: input.amount },
        customer: { email: input.email, name: input.customer_name },
        reference,
        metadata: { session_id: input.session_id },
        success_url: `${storefrontUrl}/${input.country_code}/checkout/bachs/return`,
        cancel_url: `${storefrontUrl}/${input.country_code}/checkout?step=payment`,
      },
      reference,
    )

    return {
      ...input,
      reference,
      checkout_id: checkout.checkout_id,
      checkout_url: checkout.checkout_url,
      expires_at: checkout.expires_at ?? null,
    }
  }

  private isPaid(checkout: BachsCheckoutSession) {
    if (checkout.status !== "COMPLETED" || checkout.payment_status !== "succeeded") {
      return false
    }

    const paid = checkout.charge?.amount_paid
    return !paid || MathBN.gte(MathBN.convert(paid), MathBN.convert(checkout.amount))
  }

  private mapStatus(checkout: BachsCheckoutSession, sessionData: BachsSessionData) {
    if (this.isPaid(checkout)) {
      const matches =
        checkout.currency.toUpperCase() === sessionData.currency &&
        MathBN.eq(MathBN.convert(checkout.amount), MathBN.convert(sessionData.amount)) &&
        (checkout.metadata?.session_id === undefined ||
          checkout.metadata.session_id === sessionData.session_id)

      if (!matches) {
        const message = `Bachs checkout ${checkout.checkout_id} does not match payment session ${sessionData.session_id}`
        this.logger?.error(message)
        Sentry.captureMessage(message, {
          level: "error",
          tags: { provider: "bachs" },
          extra: { checkout_id: checkout.checkout_id, session_id: sessionData.session_id },
        })
        return PaymentSessionStatus.ERROR
      }

      return PaymentSessionStatus.CAPTURED
    }

    if (checkout.status === "EXPIRED" || checkout.status === "CANCELLED") {
      return PaymentSessionStatus.CANCELED
    }

    if (checkout.payment_status === "failed") {
      return PaymentSessionStatus.ERROR
    }

    if (checkout.payment_status === "requires_action") {
      return PaymentSessionStatus.REQUIRES_MORE
    }

    return PaymentSessionStatus.PENDING
  }

  private async findCheckoutId(data: Record<string, unknown>): Promise<string | undefined> {
    const nested = [data, data.checkout, data.charge, data.object].filter(isRecord)

    for (const candidate of nested) {
      const checkoutId = asString(candidate.checkout_id)
      if (checkoutId) {
        return checkoutId
      }
    }

    const id = asString(data.id)
    if (id?.startsWith("chk_")) {
      return id
    }

    const paymentId = asString(data.payment_id) ?? asString(data.charge_id) ?? id
    if (!paymentId) {
      return undefined
    }

    const payment = await this.client.getPayment(paymentId).catch(() => undefined)
    return asString(payment?.checkout_id)
  }
}

export default BachsPaymentService
