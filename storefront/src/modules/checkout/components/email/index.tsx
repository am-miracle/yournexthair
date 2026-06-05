"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { twJoin } from "tailwind-merge"
import { z } from "zod"

import { SubmitButton } from "@modules/common/components/submit-button"
import { Button } from "@/components/Button"
import { Form, InputField } from "@/components/Forms"
import { UiCloseButton, UiDialog, UiDialogTrigger } from "@/components/Dialog"
import { UiModal, UiModalOverlay } from "@/components/ui/Modal"
import { Icon } from "@/components/Icon"
import { LoginForm } from "@modules/auth/components/LoginForm"
import ErrorMessage from "@modules/checkout/components/error-message"
import { useCustomer } from "hooks/customer"
import { useSetEmail } from "hooks/cart"
import { StoreCart } from "@medusajs/types"
import { withDefinedProp } from "@/lib/util/optional-props"

export const emailFormSchema = z.object({
  email: z.email("Enter a valid email address.").min(3),
})

const Email = ({ countryCode, cart }: { countryCode: string; cart: StoreCart }) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const { data: customer, isPending: customerPending } = useCustomer()

  const isOpen = searchParams.get("step") === "email"

  const { mutate, isPending, data } = useSetEmail()

  const onSubmit = (values: z.infer<typeof emailFormSchema>) => {
    mutate(
      { ...values, country_code: countryCode },
      {
        onSuccess: (res) => {
          if (isOpen && res?.success) {
            router.push(pathname + "?step=delivery", { scroll: false })
          }
        },
      },
    )
  }

  return (
    <>
      <div className="mb-6 flex justify-between gap-4 md:mb-8">
        <div className="flex flex-1 flex-wrap justify-between gap-4 md:gap-5">
          <div>
            <p
              className={twJoin("transition-[font-weight] duration-75", isOpen && "font-semibold")}
            >
              1. Email
            </p>
          </div>
          {isOpen && !customer && !customerPending && (
            <div className="text-grayscale-500">
              <p>
                Already have an account? No worries, just{" "}
                <UiDialogTrigger>
                  <Button variant="link">log in.</Button>
                  <UiModalOverlay>
                    <UiModal className="relative max-w-108">
                      <UiDialog>
                        <p className="text-md mb-10">Log in</p>
                        <LoginForm
                          redirectUrl={`/${countryCode}/checkout?step=delivery`}
                          handleCheckout={onSubmit}
                        />
                        <UiCloseButton variant="ghost" className="absolute top-4 right-6 p-0">
                          <Icon name="close" className="w-6 h-6" />
                        </UiCloseButton>
                      </UiDialog>
                    </UiModal>
                  </UiModalOverlay>
                </UiDialogTrigger>
              </p>
            </div>
          )}
        </div>
        {!isOpen && (
          <Button
            variant="link"
            onPress={() => {
              router.push(pathname + "?step=email")
            }}
          >
            Change
          </Button>
        )}
      </div>
      {isOpen ? (
        <Form
          schema={emailFormSchema}
          onSubmit={onSubmit}
          formProps={{
            id: `email`,
          }}
          defaultValues={{ email: cart?.email || "" }}
        >
          {({ watch }) => {
            const formValue = watch("email")
            return (
              <>
                <InputField
                  placeholder="Email"
                  name="email"
                  inputProps={{
                    autoComplete: "email",
                    title: "Enter a valid email address.",
                  }}
                  data-testid="shipping-email-input"
                />
                <SubmitButton className="mt-8" isLoading={isPending} isDisabled={!formValue}>
                  Next
                </SubmitButton>
                <ErrorMessage {...withDefinedProp("error", data?.error)} />
              </>
            )
          }}
        </Form>
      ) : cart?.email ? (
        <ul className="grid gap-2 md:grid-cols-[minmax(0,9rem)_1fr] md:gap-4">
          <li className="text-grayscale-500">Email</li>
          <li className="text-grayscale-600 break-all">{cart.email}</li>
        </ul>
      ) : null}
    </>
  )
}

export default Email
