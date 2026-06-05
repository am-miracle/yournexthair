import * as React from "react"

import { UiRadio, UiRadioBox, UiRadioLabel } from "@/components/ui/Radio"

type PaymentContainerProps = {
  paymentProviderId: string
  disabled?: boolean
  paymentInfoMap: Record<string, { title: string; icon: React.ReactNode }>
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  paymentInfoMap,
  disabled = false,
}) => {
  return (
    <UiRadio
      key={paymentProviderId}
      variant="outline"
      value={paymentProviderId}
      isDisabled={disabled}
      className="gap-4"
    >
      <UiRadioBox />
      <UiRadioLabel>
        {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
      </UiRadioLabel>
      <span className="ml-auto group-data-[selected=true]:font-normal">
        {paymentInfoMap[paymentProviderId]?.icon}
      </span>
    </UiRadio>
  )
}

export default PaymentContainer
