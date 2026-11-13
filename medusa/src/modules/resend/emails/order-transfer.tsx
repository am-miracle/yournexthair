import { Text, Heading, Button, Row, Column, Section } from "@react-email/components"
import EmailLayout, { type EmailLayoutProps } from "./components/EmailLayout"

type Props = {
  customer: { first_name: string | null }
  orders: { display_id: number; created_at: string; currency_code: string; total: number }[]
  claim_url: string
}

const formatTotal = (amount: number, currency: string) =>
  new Intl.NumberFormat([], { style: "currency", currencyDisplay: "narrowSymbol", currency }).format(amount)

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))

export default function OrderTransferEmail({ customer, orders, claim_url, ...emailLayoutProps }: Props & EmailLayoutProps) {
  const count = orders.length
  const noun = count === 1 ? "order" : "orders"
  return (
    <EmailLayout {...emailLayoutProps}>
      <Heading className="text-2xl mt-0 mb-10 font-medium">
        Add your past {noun} to your account
      </Heading>
      <Text className="text-md mb-6!">
        {customer.first_name ? `Hi ${customer.first_name}, we` : "We"} found {count} {noun} placed
        with this email address before you created your account:
      </Text>
      <Section className="mb-10">
        {orders.map((order) => (
          <Row key={order.display_id} className="mb-2">
            <Column>
              <Text className="m-0 text-base">
                Order #{order.display_id} · {formatDate(order.created_at)}
              </Text>
            </Column>
            <Column align="right">
              <Text className="m-0 text-base">{formatTotal(order.total, order.currency_code)}</Text>
            </Column>
          </Row>
        ))}
      </Section>
      <Button
        href={claim_url}
        className="inline-flex items-center rounded-xs justify-center transition-colors bg-black text-white h-10 px-6 mb-10"
      >
        Add {count === 1 ? "it" : "them"} to my account
      </Button>
      <Text className="text-md text-grayscale-500 m-0">
        If you didn&apos;t create an account with us, ignore this email and nothing will change.
      </Text>
    </EmailLayout>
  )
}

OrderTransferEmail.PreviewProps = {
  customer: { first_name: "Ada" },
  orders: [
    { display_id: 12, created_at: "2026-11-05T10:00:00.000Z", currency_code: "ngn", total: 220375 },
    { display_id: 7, created_at: "2026-10-01T10:00:00.000Z", currency_code: "ngn", total: 96750 },
  ],
  claim_url: "http://localhost:8000/ng/claim-orders#c=order_1.token",
} satisfies Props
