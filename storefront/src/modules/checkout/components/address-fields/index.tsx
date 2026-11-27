"use client"

import { useState } from "react"
import * as ReactAria from "react-aria-components"
import { HttpTypes } from "@medusajs/types"
import { useController, useWatch } from "react-hook-form"

import { CountrySelectField, InputField } from "@/components/Forms"
import { Button } from "@/components/Button"
import {
  UiSelectButton,
  UiSelectIcon,
  UiSelectListBox,
  UiSelectListBoxItem,
  UiSelectValue,
} from "@/components/ui/Select"
import {
  ADDRESS_FIELD_MAX_LENGTH,
  NIGERIAN_STATES,
  isNigeria,
  nigerianStateValue,
} from "@lib/util/address"

type Prefix = "shipping_address" | "billing_address"
const labels = { shipping_address: "Shipping", billing_address: "Billing" } as const

export const StateField = ({
  prefix,
  isRequired,
  className,
}: {
  prefix: Prefix
  isRequired?: boolean
  className?: string
}) => {
  const label = labels[prefix]
  const countryCode = useWatch({ name: `${prefix}.country_code` }) as string | undefined
  const { field, fieldState } = useController({ name: `${prefix}.province` })

  if (!isNigeria(countryCode)) {
    return (
      <InputField
        {...(className ? { className } : {})}
        placeholder={`State / Province${isRequired ? " *" : ""}`}
        name={`${prefix}.province`}
        inputProps={{
          autoComplete: "address-level1",
          "aria-label": `${label} state or province`,
        }}
      />
    )
  }

  return (
    <div className={className}>
      <ReactAria.Select
        aria-label={`${label} state`}
        placeholder={`State${isRequired ? " *" : ""}`}
        selectedKey={nigerianStateValue(field.value)}
        onSelectionChange={(key) => field.onChange(key)}
        onBlur={field.onBlur}
        isInvalid={Boolean(fieldState.error)}
        name={`${prefix}.province`}
      >
        <UiSelectButton className="h-14!">
          <UiSelectValue className="text-base" />
          <UiSelectIcon />
        </UiSelectButton>
        <ReactAria.Popover className="w-[--trigger-width]">
          <UiSelectListBox className="max-h-80 overflow-auto">
            {NIGERIAN_STATES.map(({ value, label: stateLabel }) => (
              <UiSelectListBoxItem key={value} id={value}>
                {stateLabel}
              </UiSelectListBoxItem>
            ))}
          </UiSelectListBox>
        </ReactAria.Popover>
      </ReactAria.Select>
      {fieldState.error && (
        <div className="pt-2 text-red-900 text-small-regular">
          <span>{fieldState.error.message}</span>
        </div>
      )}
    </div>
  )
}

export const AddressFields = ({
  prefix,
  countries,
  region,
  requireContact,
}: {
  prefix: Prefix
  countries?: NonNullable<HttpTypes.StoreRegion["countries"]>
  region?: HttpTypes.StoreRegion
  requireContact?: boolean
}) => {
  const label = labels[prefix]
  const testId = prefix === "shipping_address" ? "shipping" : "billing"
  const countryCode = useWatch({ name: `${prefix}.country_code` }) as string | undefined
  const company = useWatch({ name: `${prefix}.company` }) as string | undefined
  const [showCompany, setShowCompany] = useState(Boolean(company))
  const nigeria = isNigeria(countryCode)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <CountrySelectField
        className="md:col-span-2"
        name={`${prefix}.country_code`}
        selectProps={{
          autoComplete: "country",
          "aria-label": `${label} country`,
          ...(countries ? { countries } : {}),
          ...(region ? { region } : {}),
        }}
        data-testid={`${testId}-country-select`}
      />
      <InputField
        placeholder="First name *"
        name={`${prefix}.first_name`}
        inputProps={{ autoComplete: "given-name", "aria-label": `${label} first name` }}
      />
      <InputField
        placeholder="Last name *"
        name={`${prefix}.last_name`}
        inputProps={{ autoComplete: "family-name", "aria-label": `${label} last name` }}
      />
      <InputField
        placeholder="Street address *"
        name={`${prefix}.address_1`}
        className="md:col-span-2"
        maxLength={ADDRESS_FIELD_MAX_LENGTH}
        inputProps={{ autoComplete: "address-line1", "aria-label": `${label} address line 1` }}
      />
      <InputField
        placeholder="Estate, landmark, apartment (optional)"
        name={`${prefix}.address_2`}
        className="md:col-span-2"
        maxLength={ADDRESS_FIELD_MAX_LENGTH}
        hint="Long address? Continue it here."
        inputProps={{ autoComplete: "address-line2", "aria-label": `${label} address line 2` }}
      />
      <InputField
        placeholder="City *"
        name={`${prefix}.city`}
        maxLength={ADDRESS_FIELD_MAX_LENGTH}
        inputProps={{ autoComplete: "address-level2", "aria-label": `${label} city` }}
      />
      <StateField prefix={prefix} isRequired={Boolean(requireContact)} />
      <InputField
        placeholder={nigeria ? "Postal code (optional)" : "Postal code *"}
        name={`${prefix}.postal_code`}
        inputProps={{ autoComplete: "postal-code", "aria-label": `${label} postal code` }}
      />
      <InputField
        placeholder={`Phone${requireContact ? " *" : ""}`}
        name={`${prefix}.phone`}
        type="tel"
        {...(nigeria ? { hint: "e.g. 0803 123 4567" } : {})}
        inputProps={{ autoComplete: "tel", "aria-label": `${label} phone` }}
      />
      {showCompany ? (
        <InputField
          placeholder="Company"
          name={`${prefix}.company`}
          className="md:col-span-2"
          inputProps={{ autoComplete: "organization", "aria-label": `${label} company` }}
        />
      ) : (
        <Button
          variant="link"
          size="sm"
          className="justify-self-start md:col-span-2"
          onPress={() => setShowCompany(true)}
        >
          Add company
        </Button>
      )}
    </div>
  )
}
