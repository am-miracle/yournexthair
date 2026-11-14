import { HttpTypes } from "@medusajs/types"

import { paymentInfoMap } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { formatOrderDateTime } from "@lib/util/order-format"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const statusLabels: Record<HttpTypes.StoreOrder["payment_status"], string> = {
  not_paid: "Not paid",
  awaiting: "Payment pending",
  authorized: "Authorized — awaiting capture",
  partially_authorized: "Partially authorized — awaiting capture",
  captured: "Captured",
  partially_captured: "Partially captured",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  canceled: "Payment canceled",
  requires_action: "Payment requires action",
}

function settledAmount(reported: number | undefined, records: { amount: number }[] | undefined) {
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0) return reported
  // An absent relation means unknown; a loaded, empty relation means zero.
  if (!records || records.some(({ amount }) => !Number.isFinite(amount) || amount < 0))
    return undefined
  return records.reduce((sum, record) => sum + record.amount, 0)
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => (
  <div className="text-grayscale-500 space-y-3">
    <p className="text-black">
      {statusLabels[order.payment_status] ?? "Payment status unavailable"}
    </p>
    {order.payment_collections?.flatMap(
      (collection) =>
        collection.payments?.map((payment) => {
          const captured = settledAmount(payment.captured_amount, payment.captures)
          const refunded = settledAmount(payment.refunded_amount, payment.refunds)
          const money = (amount: number | undefined) =>
            amount === undefined
              ? "Unavailable"
              : convertToLocale({
                  amount,
                  currency_code: payment.currency_code ?? order.currency_code,
                })
          const capturedAt =
            payment.captured_at && Number.isFinite(new Date(payment.captured_at).getTime())
              ? payment.captured_at
              : undefined

          return (
            <div key={payment.id}>
              <p className="text-black">
                {paymentInfoMap[payment.provider_id]?.title ?? "Online payment"}
              </p>
              {payment.canceled_at && <p>Payment canceled</p>}
              <p>{`Captured: ${money(captured)}`}</p>
              <p>{`Refunded: ${money(refunded)}`}</p>
              {captured !== undefined && refunded !== undefined && (
                <p>{`Net collected: ${money(captured - refunded)}`}</p>
              )}
              {captured !== undefined && captured > 0 && capturedAt && (
                <p>{`Captured on ${formatOrderDateTime(capturedAt)}`}</p>
              )}
            </div>
          )
        }) ?? [],
    )}
  </div>
)

export default PaymentDetails
