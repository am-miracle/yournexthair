import { HttpTypes } from "@medusajs/types"

import { paymentInfoMap } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { formatOrderDateTime } from "@lib/util/order-format"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0]?.payments?.[0]

  if (!payment) {
    return <p className="text-grayscale-500">Payment pending</p>
  }

  const paidAt = payment.captured_at ?? payment.created_at

  return (
    <div className="text-grayscale-500">
      <p className="text-black">{paymentInfoMap[payment.provider_id]?.title ?? "Online payment"}</p>
      <p>
        {convertToLocale({ amount: payment.amount, currency_code: order.currency_code })}
        {paidAt ? ` paid on ${formatOrderDateTime(paidAt)}` : ""}
      </p>
    </div>
  )
}

export default PaymentDetails
