"use client"

import * as React from "react"
import * as ReactAria from "react-aria-components"
import { CountrySelectProps } from "@modules/checkout/components/country-select"
import { CountrySelectField, Form, InputField } from "@/components/Forms"
import { UiCloseButton } from "@/components/Dialog"
import { z } from "zod"
import { withDefinedProp, withNonNullProp } from "@lib/util/optional-props"
import { SubmitButton } from "@modules/common/components/submit-button"
import { customerAddressSchema, useAddressMutation } from "hooks/customer"
export const UpsertAddressForm = ({
  addressId,
  region,
  defaultValues,
}: {
  addressId?: string
  region?: CountrySelectProps["region"]
  defaultValues?: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    postal_code?: string
    province?: string
    country_code?: string
    phone?: string
  }
}) => {
  const { close } = React.useContext(ReactAria.OverlayTriggerStateContext)!
  const { mutate, isPending, data } = useAddressMutation(addressId)

  const onSubmit = (values: z.infer<typeof customerAddressSchema>) => {
    mutate(values, {
      onSuccess: (res) => {
        if (res.success) {
          close()
        }
      },
    })
  }

  return (
    <Form
      onSubmit={onSubmit}
      schema={customerAddressSchema}
      {...withDefinedProp(
        "defaultValues",
        defaultValues
          ? {
              ...withDefinedProp("first_name", defaultValues.first_name),
              ...withDefinedProp("last_name", defaultValues.last_name),
              ...withNonNullProp("company", defaultValues.company),
              ...withDefinedProp("address_1", defaultValues.address_1),
              ...withNonNullProp("address_2", defaultValues.address_2),
              ...withNonNullProp("phone", defaultValues.phone),
              ...withDefinedProp("city", defaultValues.city),
              ...withDefinedProp("postal_code", defaultValues.postal_code),
              ...withDefinedProp("country_code", defaultValues.country_code),
              ...withNonNullProp("province", defaultValues.province),
            }
          : undefined,
      )}
    >
      {({ watch, formState }) => {
        const watchedValues = watch()
        const isDisabled =
          !Object.values(watchedValues).some((value) => value) ||
          !formState.isDirty
        return (
          <>
            <h3 className="text-md mb-8 md:mb-10">
              {addressId ? "Change address" : "Add another address"}
            </h3>
            <div className="flex flex-col gap-4 md:gap-8 mb-8 md:mb-10">
              <div className="flex max-xs:flex-col gap-4 md:gap-6">
                <InputField
                  placeholder="First name"
                  name="first_name"
                  className=" flex-1"
                  inputProps={{
                    autoComplete: "given-name",
                    "aria-label": "First name",
                  }}
                />
                <InputField
                  placeholder="Last name"
                  name="last_name"
                  className=" flex-1"
                  inputProps={{
                    autoComplete: "family-name",
                    "aria-label": "Last name",
                  }}
                />
              </div>
              <InputField
                placeholder="Company (Optional)"
                name="company"
                className=" flex-1"
                inputProps={{
                  autoComplete: "organization",
                  "aria-label": "Company",
                }}
              />
              <InputField
                placeholder="Address"
                name="address_1"
                inputProps={{
                  autoComplete: "address-line1",
                  "aria-label": "Address line 1",
                }}
              />
              <InputField
                placeholder="Apartment, suite, etc. (Optional)"
                name="address_2"
                inputProps={{
                  autoComplete: "address-line2",
                  "aria-label": "Address line 2",
                }}
              />
              <InputField
                placeholder="Phone (Optional)"
                name="phone"
                type="tel"
                inputProps={{
                  autoComplete: "tel",
                  "aria-label": "Phone",
                }}
              />
              <div className="flex max-xs:flex-col gap-4 md:gap-6">
                <InputField
                  placeholder="Postal code"
                  name="postal_code"
                  className=" flex-1"
                  inputProps={{
                    autoComplete: "postal-code",
                    "aria-label": "Postal code",
                  }}
                />
                <InputField
                  placeholder="City"
                  name="city"
                  className=" flex-1"
                  inputProps={{ autoComplete: "address-level2", "aria-label": "City" }}
                />
              </div>
              <div className="flex max-xs:flex-col gap-4 md:gap-6">
                <InputField
                  placeholder="Province (Optional)"
                  name="province"
                  className=" flex-1"
                  inputProps={{ autoComplete: "address-level1", "aria-label": "State or province" }}
                />
                <CountrySelectField
                  selectProps={{
                    ...withDefinedProp("region", region),
                    ...withNonNullProp("defaultValue", defaultValues?.country_code),
                    autoComplete: "country",
                    "aria-label": "Country",
                  }}
                  name="country_code"
                  className="flex-1"
                />
              </div>
              {!data?.success && (
                <p className="text-red-primary">{data?.error}</p>
              )}
            </div>
            <div className="flex gap-6 justify-between">
              <SubmitButton isLoading={isPending} isDisabled={isDisabled}>
                {addressId ? "Save changes" : "Add address"}
              </SubmitButton>
              <UiCloseButton variant="outline">Cancel</UiCloseButton>
            </div>
          </>
        )
      }}
    </Form>
  )
}
