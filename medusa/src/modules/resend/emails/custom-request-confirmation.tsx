import { Button, Heading, Text } from "@react-email/components"
import EmailLayout, { type EmailLayoutProps } from "./components/EmailLayout"

export type CustomRequestConfirmationEmailProps = {
  reference: string
  name: string
  whatsapp: string
  whatsapp_url: string
}

export default function CustomRequestConfirmationEmail({
  reference,
  name,
  whatsapp,
  whatsapp_url,
  ...emailLayoutProps
}: CustomRequestConfirmationEmailProps & EmailLayoutProps) {
  return (
    <EmailLayout {...emailLayoutProps}>
      <Heading className="text-2xl mt-0 mb-10 font-medium">We’ve received your request</Heading>
      <Text className="text-md mb-6!">
        Hi {name}, thank you for your custom-order request. Your reference is{" "}
        <strong>{reference}</strong>.
      </Text>
      <Text className="text-md mb-10!">
        We’ll review your requirements and contact you on WhatsApp at {whatsapp} with a quote. If
        you have reference photos, you can send them to us on WhatsApp now.
      </Text>
      <Button
        href={whatsapp_url}
        className="inline-flex items-center rounded-xs justify-center bg-black text-white h-10 px-6 mb-10"
      >
        Send photos on WhatsApp
      </Button>
      <Text className="text-md text-grayscale-500 m-0">
        Nothing has been charged. We’ll confirm the price, delivery and production time with you
        before you pay.
      </Text>
    </EmailLayout>
  )
}

CustomRequestConfirmationEmail.PreviewProps = {
  reference: "YNH-1042",
  name: "Ada",
  whatsapp: "+2348000000000",
  whatsapp_url: "https://wa.me/2348156197614",
} satisfies CustomRequestConfirmationEmailProps
