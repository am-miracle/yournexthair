"use client"
import { SubmitButton } from "@modules/common/components/submit-button"
import { Form, InputField } from "@/components/Forms"
import { LocalizedLink } from "@/components/LocalizedLink"
import { twMerge } from "tailwind-merge"
import { z } from "zod"
import { useLogin } from "hooks/customer"
import { useRouter } from "next/navigation"
import { emailFormSchema } from "@modules/checkout/components/email"

const loginFormSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

export const LoginForm = ({
  className,
  redirectUrl,
  handleCheckout,
}: {
  className?: string
  redirectUrl?: string
  handleCheckout?: (values: z.infer<typeof emailFormSchema>) => void
}) => {
  const { isPending, data, mutate } = useLogin()

  const router = useRouter()

  const onSubmit = (values: z.infer<typeof loginFormSchema>) => {
    mutate(
      { ...values, redirect_url: redirectUrl },
      {
        onSuccess: (res) => {
          if (handleCheckout && res.success) {
            handleCheckout({ email: values.email })
          } else if (res.success) {
            router.push(res.redirectUrl || "/")
          }
        },
      },
    )
  }
  return (
    <Form onSubmit={onSubmit} schema={loginFormSchema}>
      <div className={twMerge("flex flex-col gap-6 md:gap-8", className)}>
        <InputField
          placeholder="Email"
          name="email"
          inputProps={{ autoComplete: "email", "aria-label": "Email" }}
          className="flex-1"
        />
        <InputField
          placeholder="Password"
          name="password"
          type="password"
          className="flex-1"
          inputProps={{ autoComplete: "current-password", "aria-label": "Password" }}
        />
        <LocalizedLink
          href="/auth/forgot-password"
          variant="underline"
          className="self-start pb-0! text-grayscale-500 leading-none"
        >
          Forgot password?
        </LocalizedLink>
        {!data?.success && data?.message && (
          <p className="text-red-primary text-sm" role="alert">
            {data.message}
          </p>
        )}
        <SubmitButton isLoading={isPending}>Log in</SubmitButton>
      </div>
    </Form>
  )
}
