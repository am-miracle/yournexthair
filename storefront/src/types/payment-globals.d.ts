interface FlutterwaveCheckoutOptions {
  public_key: string
  tx_ref: string
  amount: number
  currency: string
  customer: {
    email: string
    name?: string
    phone_number?: string
  }
  meta?: Record<string, unknown>
  customizations?: {
    title?: string
    description?: string
    logo?: string
  }
  callback: (data: FlutterwaveCallbackData) => void
  onclose: (incomplete?: boolean) => void
}

interface FlutterwaveCallbackData {
  transaction_id: number
  tx_ref: string
  flw_ref: string
  status: "successful" | "failed" | "pending"
  amount: number
  currency: string
  payment_type: string
  customer: { email: string; name: string; phone_number: string }
}

declare function FlutterwaveCheckout(options: FlutterwaveCheckoutOptions): void

interface PaystackTransactionOptions {
  onSuccess: (transaction: { reference: string }) => void
  onCancel: () => void
  onError?: (error: unknown) => void
}

interface PaystackPop {
  resumeTransaction(accessCode: string, options?: PaystackTransactionOptions): void
}

interface Window {
  FlutterwaveCheckout: typeof FlutterwaveCheckout
  PaystackPop: new () => PaystackPop
}
