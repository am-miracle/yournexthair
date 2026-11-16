import { Button, Column, Heading, Row, Section, Text } from "@react-email/components"
import EmailLayout, { type EmailLayoutProps } from "./components/EmailLayout"

export type CustomRequestReceivedEmailProps = {
  reference: string
  admin_url: string
  whatsapp_url: string
  request: {
    name: string
    whatsapp: string
    email: string | null
    location: string
    description: string
    details: { label: string; value: string }[]
  }
}

export default function CustomRequestReceivedEmail({
  reference,
  admin_url,
  whatsapp_url,
  request,
  ...emailLayoutProps
}: CustomRequestReceivedEmailProps & EmailLayoutProps) {
  const contact = [
    { label: "Name", value: request.name },
    { label: "WhatsApp", value: request.whatsapp },
    ...(request.email ? [{ label: "Email", value: request.email }] : []),
    { label: "Deliver to", value: request.location },
  ]
  return (
    <EmailLayout {...emailLayoutProps}>
      <Heading className="text-2xl mt-0 mb-4 font-medium">New custom-order request</Heading>
      <Text className="text-md mt-0 mb-8">
        {reference} from {request.name}
      </Text>
      <Text className="text-base font-semibold mb-2">What they want</Text>
      <Text className="text-base mt-0 mb-8 whitespace-pre-line">{request.description}</Text>
      <Section className="mb-10">
        {[...request.details, ...contact].map(({ label, value }) => (
          <Row key={label} className="mb-2">
            <Column className="w-1/3 align-top">
              <Text className="m-0 text-base text-grayscale-500">{label}</Text>
            </Column>
            <Column>
              <Text className="m-0 text-base">{value}</Text>
            </Column>
          </Row>
        ))}
      </Section>
      <Button
        href={admin_url}
        className="inline-flex items-center rounded-xs justify-center bg-black text-white h-10 px-6 mb-4"
      >
        Open in Admin
      </Button>
      <Text className="text-base m-0">
        Or reply directly on <a href={whatsapp_url}>WhatsApp</a>.
      </Text>
    </EmailLayout>
  )
}

CustomRequestReceivedEmail.PreviewProps = {
  reference: "YNH-1042",
  admin_url: "http://localhost:9000/app/custom-requests/creq_123",
  whatsapp_url: "https://wa.me/2348000000000",
  request: {
    name: "Ada Obi",
    whatsapp: "+2348000000000",
    email: "ada@example.com",
    location: "Lagos, Nigeria",
    description: "A 24-inch body wave frontal wig with a natural hairline.",
    details: [
      { label: "Hair type", value: "Raw hair" },
      { label: "Texture", value: "Body Wave" },
      { label: "Length", value: "24 inches" },
      { label: "Budget", value: "₦600,000" },
    ],
  },
} satisfies CustomRequestReceivedEmailProps
