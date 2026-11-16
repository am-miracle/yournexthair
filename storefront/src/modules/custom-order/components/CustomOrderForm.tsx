"use client"

import * as React from "react"
import * as ReactAria from "react-aria-components"
import { useController } from "react-hook-form"
import { twJoin } from "tailwind-merge"
import { Form, InputField, InputLabel } from "@/components/Forms"
import { Button, ButtonAnchor } from "@/components/Button"
import { LocalizedButtonLink, LocalizedLink } from "@/components/LocalizedLink"
import {
  UiSelectButton,
  UiSelectIcon,
  UiSelectListBox,
  UiSelectListBoxItem,
  UiSelectValue,
} from "@/components/ui/Select"
import { customOrderWhatsappUrl } from "@lib/consultation"
import {
  HAIR_TYPE_OPTIONS,
  LENGTH_OPTIONS,
  NOT_SURE,
  TEXTURE_OPTIONS,
  customOrderSchema,
  toSubmission,
  type CustomOrderValues,
} from "@lib/custom-order"
import { submitCustomOrder } from "@lib/data/custom-requests"

type Option = { id: string; label: string }

function FieldError({ name }: { name: string }) {
  const { fieldState } = useController({ name })
  if (!fieldState.error) return null
  return (
    <p id={`${name}-error`} className="mt-2 text-xs text-red-primary">
      {fieldState.error.message}
    </p>
  )
}

function SelectField({
  name,
  label,
  options,
  isRequired,
}: {
  name: keyof CustomOrderValues
  label: string
  options: Option[]
  isRequired?: boolean
}) {
  const { field, fieldState } = useController<CustomOrderValues>({ name })
  return (
    <div>
      <ReactAria.Select
        selectedKey={(field.value as string) || null}
        onSelectionChange={(key) => field.onChange(String(key))}
        onBlur={field.onBlur}
        isInvalid={Boolean(fieldState.error)}
        isRequired={Boolean(isRequired)}
        name={name}
      >
        <InputLabel isRequired={Boolean(isRequired)}>{label}</InputLabel>
        <UiSelectButton
          className="h-14! text-base data-[invalid]:border-red-primary"
          {...(fieldState.error ? { "aria-describedby": `${name}-error` } : {})}
        >
          <UiSelectValue className="text-base data-[placeholder]:text-grayscale-400" />
          <UiSelectIcon />
        </UiSelectButton>
        <ReactAria.Popover className="w-(--trigger-width)">
          <UiSelectListBox>
            {options.map((option) => (
              <UiSelectListBoxItem key={option.id} id={option.id}>
                {option.label}
              </UiSelectListBoxItem>
            ))}
          </UiSelectListBox>
        </ReactAria.Popover>
      </ReactAria.Select>
      <FieldError name={name} />
    </div>
  )
}

function TextField({
  name,
  label,
  hint,
  isRequired,
  ...inputProps
}: {
  name: keyof CustomOrderValues
  label: string
  hint?: string
  isRequired?: boolean
} & Pick<
  React.ComponentProps<"input">,
  "autoComplete" | "inputMode" | "placeholder" | "type" | "maxLength"
>) {
  return (
    <div>
      <InputLabel htmlFor={name} isRequired={Boolean(isRequired)}>
        {label}
      </InputLabel>
      {hint && (
        <p id={`${name}-hint`} className="mb-2 text-xs text-grayscale-500">
          {hint}
        </p>
      )}
      <InputField
        name={name}
        {...(inputProps.type ? { type: inputProps.type } : {})}
        {...(inputProps.placeholder ? { placeholder: inputProps.placeholder } : {})}
        inputProps={{
          uiSize: "md",
          hasFloatingPlaceholder: false,
          required: Boolean(isRequired),
          ...(hint ? { "aria-describedby": `${name}-hint` } : {}),
          ...(inputProps.autoComplete ? { autoComplete: inputProps.autoComplete } : {}),
          ...(inputProps.inputMode ? { inputMode: inputProps.inputMode } : {}),
          ...(inputProps.maxLength ? { maxLength: inputProps.maxLength } : {}),
        }}
      />
    </div>
  )
}

function DescriptionField() {
  const { field, fieldState } = useController<CustomOrderValues, "description">({
    name: "description",
  })
  const length = field.value?.length ?? 0
  return (
    <div>
      <InputLabel htmlFor="description" isRequired>
        Describe the hair or wig you want
      </InputLabel>
      <p id="description-hint" className="mb-2 text-xs text-grayscale-500">
        Colour, lace, density, cap size, hairline, or a look you love. You can send reference photos
        on WhatsApp after you submit.
      </p>
      <textarea
        {...field}
        id="description"
        rows={5}
        required
        maxLength={2000}
        aria-invalid={Boolean(fieldState.error)}
        aria-describedby={twJoin(
          "description-hint description-count",
          fieldState.error && "description-error",
        )}
        placeholder="e.g. A 24-inch body wave frontal wig in natural black, 180% density, with a pre-plucked hairline."
        className="block w-full resize-y rounded-xs border border-grayscale-200 bg-transparent px-4 py-3 outline-none transition-colors placeholder:text-grayscale-400 hover:border-grayscale-500 focus:border-grayscale-500 aria-[invalid=true]:border-red-primary"
      />
      <div className="flex justify-between gap-4">
        <FieldError name="description" />
        <p id="description-count" className="ml-auto mt-2 text-xs text-grayscale-500">
          {length}/2000
        </p>
      </div>
    </div>
  )
}

function SuccessMessage({ reference }: { reference: string }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    headingRef.current?.focus()
  }, [])
  return (
    <div className="rounded-2xl border border-accent/15 bg-accent-soft p-6 md:p-10">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mb-4 text-lg font-medium outline-none md:text-xl"
      >
        Your custom-order request has been received.
      </h2>
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">Reference</p>
      <p className="mb-6 text-xl font-medium tabular-nums" data-testid="custom-order-reference">
        {reference}
      </p>
      <p className="mb-8 text-grayscale-700">
        We’ll review your requirements and contact you on WhatsApp with a quote. Nothing has been
        charged — you’ll confirm the price, delivery and production time before you pay.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonAnchor
          href={customOrderWhatsappUrl(reference)}
          target="_blank"
          rel="noopener noreferrer"
          iconName="arrow-up-right"
          iconPosition="end"
          aria-label="Discuss this request on WhatsApp (opens in a new tab)"
        >
          Discuss this request on WhatsApp
        </ButtonAnchor>
        <LocalizedButtonLink href="/store" variant="outline">
          Continue shopping
        </LocalizedButtonLink>
      </div>
      <p className="mt-4 text-xs text-grayscale-600">
        Have reference photos? Send them in the WhatsApp chat — your reference is already in the
        message.
      </p>
    </div>
  )
}

export function CustomOrderForm({
  countries,
  defaultCountry,
}: {
  countries: Option[]
  defaultCountry: string
}) {
  const [result, submit, isPending] = React.useActionState(submitCustomOrder, {
    state: "initial",
  })
  const submissionKey = React.useRef<string | null>(null)

  if (result.state === "success") {
    return <SuccessMessage reference={result.reference} />
  }

  const onSubmit = (values: CustomOrderValues) => {
    // Reused across retries so a timed-out request that actually saved isn't recorded twice.
    submissionKey.current ??= crypto.randomUUID()
    const submission = toSubmission(values, submissionKey.current)
    React.startTransition(() => submit(submission))
  }

  return (
    <Form
      schema={customOrderSchema}
      onSubmit={onSubmit}
      mode="onTouched"
      defaultValues={{
        description: "",
        hair_type: NOT_SURE,
        texture: NOT_SURE,
        length: NOT_SURE,
        budget: "",
        name: "",
        whatsapp: "",
        email: "",
        country_code: countries.some((country) => country.id === defaultCountry)
          ? defaultCountry
          : "",
        city: "",
        website: "",
      }}
      formProps={{ "aria-labelledby": "custom-order-heading", noValidate: true }}
    >
      <div className="flex flex-col gap-12">
        <section aria-labelledby="hair-section" className="flex flex-col gap-6">
          <h2 id="hair-section" className="text-md font-medium">
            Your hair
          </h2>
          <DescriptionField />
          <SelectField name="hair_type" label="Hair type" options={HAIR_TYPE_OPTIONS} />
          <div className="grid gap-6 sm:grid-cols-2">
            <SelectField name="texture" label="Texture" options={TEXTURE_OPTIONS} />
            <SelectField name="length" label="Length" options={LENGTH_OPTIONS} />
          </div>
          <TextField
            name="budget"
            label="Budget (optional)"
            placeholder="e.g. ₦600,000 or $400"
            maxLength={120}
          />
        </section>

        <section aria-labelledby="details-section" className="flex flex-col gap-6">
          <h2 id="details-section" className="text-md font-medium">
            Your details
          </h2>
          <TextField name="name" label="Name" autoComplete="name" isRequired />
          <TextField
            name="whatsapp"
            label="WhatsApp number"
            hint="We’ll send your quote here. Include your country code if you’re outside Nigeria."
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+234 815 619 7614"
            isRequired
          />
          <TextField
            name="email"
            label="Email (optional)"
            hint="For a copy of your request."
            type="email"
            autoComplete="email"
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <SelectField
              name="country_code"
              label="Delivery country"
              options={countries}
              isRequired
            />
            <TextField name="city" label="City" autoComplete="address-level2" isRequired />
          </div>
        </section>

        <div hidden>
          <label htmlFor="website">Leave this field empty</label>
          <InputField name="website" inputProps={{ tabIndex: -1, autoComplete: "off" }} />
        </div>

        <div className="flex flex-col gap-4">
          {result.state === "error" && (
            <p role="alert" className="rounded-xs bg-accent-soft p-4 text-sm text-red-primary">
              {result.error}
            </p>
          )}
          <Button
            type="submit"
            isFullWidth
            isLoading={isPending}
            isDisabled={isPending}
            loadingText="Sending your request…"
          >
            Send request
          </Button>
          <p className="text-xs text-grayscale-600">
            There’s no charge to send a request. We only use your details to reply to it — see our{" "}
            <LocalizedLink href="/privacy-policy" variant="underline" className="pb-0!">
              Privacy Policy
            </LocalizedLink>
            .
          </p>
        </div>
      </div>
    </Form>
  )
}
