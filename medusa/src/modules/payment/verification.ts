import { MedusaError } from "@medusajs/framework/utils"

export type FlwTransactionData = {
  id: number
  tx_ref: string
  status: string
  amount: number
  charged_amount: number
  currency: string
}

export type FlwVerifyResponse = {
  status: string
  message: string
  data: FlwTransactionData
}

export type FlutterwaveSessionData = {
  tx_ref: string
  amount: number
  currency: string
  transaction_id?: number
  [key: string]: unknown
}

export const getVerifiedMainUnitAmount = (data: FlwTransactionData) =>
  Number(data.charged_amount ?? data.amount)

export const verifyFlutterwaveTransaction = async (
  transactionId: number,
  secretKey: string,
): Promise<FlwVerifyResponse> => {
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    },
  )

  if (!res.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Flutterwave verification failed: HTTP ${res.status}`,
    )
  }

  const body: unknown = await res.json()
  return body as FlwVerifyResponse
}

export const assertSuccessfulVerification = (
  verification: FlwVerifyResponse,
  session: FlutterwaveSessionData,
) => {
  if (verification.status !== "success" || verification.data.status !== "successful") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment was not successful")
  }

  if (verification.data.tx_ref !== session.tx_ref) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Transaction reference mismatch")
  }

  if (verification.data.currency !== session.currency) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Currency mismatch")
  }

  const expectedMainUnit = session.amount / 100
  if (getVerifiedMainUnitAmount(verification.data) < expectedMainUnit) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Paid amount is lower than expected",
    )
  }

  return verification.data
}
