import { Text, Heading, Button } from "@react-email/components"
import type { CustomerDTO } from "@medusajs/framework/types"
import EmailLayout, { type EmailLayoutProps } from "./components/EmailLayout"

type Props = {
  customer: Pick<CustomerDTO, "first_name">
  verifyUrl: string
}

export default function AuthEmailConfirm({
  customer,
  verifyUrl,
  ...emailLayoutProps
}: Props & EmailLayoutProps) {
  const greeting = customer.first_name ? `Hey ${customer.first_name}` : "Hey there"

  return (
    <EmailLayout {...emailLayoutProps}>
      <Heading className="text-2xl mt-0 mb-11 font-medium">Verify your email</Heading>
      <Text className="text-md mb-10">
        {greeting}, thanks for registering for an account on YourNextHair!
      </Text>
      <Text className="text-md mb-10">
        Before we get started, we just need to confirm that this is you.
        <br />
        Click below to verify your email address:
      </Text>
      <Button
        href={verifyUrl}
        className="inline-flex items-center rounded-xs justify-center transition-colors bg-black text-white h-10 px-6"
      >
        Verify email
      </Button>
    </EmailLayout>
  )
}

AuthEmailConfirm.PreviewProps = {
  customer: { first_name: "Ada" },
  verifyUrl: "http://localhost:8000/verify-email?token=preview",
} satisfies Props
