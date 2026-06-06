import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework"
import type { IPaymentModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  assertSuccessfulVerification,
  verifyFlutterwaveTransaction,
} from "../../../../../modules/payment/verification"

type CallbackBody = {
  session_id: string
  transaction_id: number
  tx_ref: string
}

export const POST = async (
  req: MedusaStoreRequest<CallbackBody>,
  res: MedusaResponse
) => {
  const secretKey = process.env.FLW_SECRET_KEY

  if (!secretKey) {
    return res.status(503).json({ error: "Flutterwave is not configured" })
  }

  const { session_id, transaction_id, tx_ref } = req.body

  if (!session_id || !transaction_id || !tx_ref) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  const paymentService: IPaymentModuleService = req.scope.resolve(Modules.PAYMENT)

  let session: Awaited<ReturnType<typeof paymentService.retrievePaymentSession>>
  try {
    session = await paymentService.retrievePaymentSession(session_id)
  } catch {
    return res.status(404).json({ error: "Payment session not found" })
  }

  // Verify our stored tx_ref matches the claimed tx_ref (prevents session poisoning)
  const storedTxRef = session.data?.tx_ref as string | undefined
  if (!storedTxRef || storedTxRef !== tx_ref) {
    return res.status(400).json({ error: "Transaction reference mismatch" })
  }

  // Already has a transaction_id — idempotency guard
  if (session.data?.transaction_id) {
    return res.status(200).json({ success: true })
  }

  const expectedCurrency = session.currency_code?.toUpperCase()
  const expectedAmount = Number(
    typeof session.data?.amount === "number" ? session.data.amount : session.amount,
  )

  let verification
  try {
    verification = await verifyFlutterwaveTransaction(transaction_id, secretKey)
    assertSuccessfulVerification(verification, {
      tx_ref,
      amount: expectedAmount,
      currency: expectedCurrency ?? "",
    })
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.UNEXPECTED_STATE) {
      return res.status(502).json({ error: "Failed to verify transaction with Flutterwave" })
    }

    return res.status(400).json({
      error: error instanceof Error ? error.message : "Payment verification failed",
    })
  }

  await paymentService.updatePaymentSession({
    id: session.id,
    amount: session.amount,
    currency_code: session.currency_code,
    data: {
      ...session.data,
      transaction_id: verification.data.id,
    },
  })

  return res.status(200).json({ success: true })
}
