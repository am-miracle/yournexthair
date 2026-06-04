import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework"
import type { IPaymentModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

type CallbackBody = {
  session_id: string
  transaction_id: number
  tx_ref: string
}

type FlwVerifyResponse = {
  status: string
  data: {
    id: number
    tx_ref: string
    status: string
    amount: number
    charged_amount: number
    currency: string
  }
}

const getVerifiedMainUnitAmount = (data: FlwVerifyResponse["data"]) =>
  Number(data.charged_amount ?? data.amount)

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

  // Verify with Flutterwave API before storing anything
  const verifyRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!verifyRes.ok) {
    return res.status(502).json({ error: "Failed to verify transaction with Flutterwave" })
  }

  const verification = (await verifyRes.json()) as FlwVerifyResponse

  if (verification.status !== "success" || verification.data.status !== "successful") {
    return res.status(400).json({ error: "Payment was not successful" })
  }

  if (verification.data.tx_ref !== tx_ref) {
    return res.status(400).json({ error: "Transaction reference mismatch from Flutterwave" })
  }

  const expectedCurrency = session.currency_code?.toUpperCase()
  if (!expectedCurrency || verification.data.currency !== expectedCurrency) {
    return res.status(400).json({ error: "Currency mismatch" })
  }

  const expectedAmount =
    typeof session.data?.amount === "number" ? session.data.amount : session.amount
  const expectedMainUnit = Number(expectedAmount) / 100
  if (getVerifiedMainUnitAmount(verification.data) < expectedMainUnit) {
    return res.status(400).json({ error: "Paid amount is lower than expected" })
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
