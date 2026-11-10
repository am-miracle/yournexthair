import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { withQueryClient } from "../components/QueryClientProvider"

type StatusResponse = {
  sessions: Array<{
    id: string
    payment_status: string | null
    refunds: Array<{ refund_id: string; status: string }>
  }>
}

function BachsPaymentStatus({ data }: DetailWidgetProps<AdminOrder>) {
  const status = useQuery<StatusResponse>({
    queryKey: ["bachs-status", data.id],
    queryFn: async () => {
      const response = await fetch(`/admin/orders/${data.id}/bachs-status`, { credentials: "include" })
      if (!response.ok) throw new Error("Could not load Bachs payment status")
      return response.json() as Promise<StatusResponse>
    },
    refetchInterval: 30_000,
  })
  if (status.isPending || (!status.isError && !status.data?.sessions.length)) return null
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">Bachs payment updates</Heading></div>
      <div className="space-y-4 px-6 py-4">
        {status.isError ? <Text>Could not load payment updates. Refresh to try again.</Text> :
          status.data?.sessions.map((session) => (
            <div key={session.id} className="space-y-1">
              <Text size="small" className="text-ui-fg-subtle">{session.id}</Text>
              {session.payment_status && <Text>Payment: {session.payment_status}</Text>}
              {session.refunds.length ? session.refunds.map((refund) => (
                <div key={refund.refund_id} className="space-y-1">
                  <Text>Refund: {refund.status === "success" ? "Sent to customer’s payment provider" : refund.status}</Text>
                  <Text size="small">Reference: {refund.refund_id}</Text>
                  {refund.status === "failed" && (
                    <Text className="text-ui-fg-error">
                      This refund failed. Review it in Bachs before taking further action.
                      Medusa’s refund record does not confirm that the customer received funds.
                    </Text>
                  )}
                </div>
              )) : <Text size="small">No refund outcome received.</Text>}
            </div>
          ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.after" })
export default withQueryClient(BachsPaymentStatus)
