"use client"

import { SubmitButton } from "@modules/common/components/submit-button"
import { Form, InputField } from "@/components/Forms"
import { z } from "zod"
import { signupFormSchema, useSignup } from "@/hooks/customer"
export const SignUpForm = () => {
  const { mutateAsync, isPending, data } = useSignup()

  const onSubmit = async (values: z.infer<typeof signupFormSchema>) => {
    await mutateAsync(values)
  }

  return (
    <Form onSubmit={onSubmit} schema={signupFormSchema}>
      {({ watch }) => {
        const formData = watch()
        const isDisabled = !Object.values(formData).some((value) => value)

        return (
          <div className="flex flex-col gap-6 md:gap-8 mb-8 md:mb-16">
            <div className="flex gap-4 md:gap-6">
              <InputField
                placeholder="First name"
                name="first_name"
                className=" flex-1"
                inputProps={{ autoComplete: "given-name", "aria-label": "First name" }}
              />
              <InputField
                placeholder="Last name"
                name="last_name"
                className=" flex-1"
                inputProps={{ autoComplete: "family-name", "aria-label": "Last name" }}
              />
            </div>
            <InputField
              placeholder="Email"
              name="email"
              className=" flex-1"
              type="email"
              inputProps={{ autoComplete: "email", "aria-label": "Email" }}
            />
            <InputField
              placeholder="Phone (Optional)"
              name="phone"
              className=" flex-1"
              type="tel"
              inputProps={{ autoComplete: "tel", "aria-label": "Phone" }}
            />
            <InputField
              placeholder="Password"
              name="password"
              type="password"
              className=" flex-1"
              inputProps={{ autoComplete: "new-password", "aria-label": "Password" }}
            />
            <InputField
              placeholder="Confirm password"
              name="confirm_password"
              type="password"
              className=" flex-1"
              inputProps={{ autoComplete: "new-password", "aria-label": "Confirm password" }}
            />
            {data?.error && (
              <p className="text-red-primary text-sm" role="alert">
                {data.error}
              </p>
            )}
            <SubmitButton isDisabled={isDisabled} isPending={isPending}>
              Create account
            </SubmitButton>
          </div>
        )
      }}
    </Form>
  )
}
