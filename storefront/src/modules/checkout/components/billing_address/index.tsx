import { useEffect, useMemo } from "react"
import * as ReactAria from "react-aria-components"

import { HttpTypes } from "@medusajs/types"
import { CountrySelectField, InputField } from "@/components/Forms"
import { Icon } from "@/components/Icon"
import { UiCloseButton, UiDialog, UiDialogTrigger } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { UiModal, UiModalOverlay } from "@/components/ui/Modal"
import { withDefinedProp } from "@lib/util/optional-props"
import compareAddresses from "@lib/util/compare-addresses"
import { UiRadio, UiRadioBox, UiRadioLabel } from "@/components/ui/Radio"
import { UpsertAddressForm } from "@modules/account/components/UpsertAddressForm"
import { useCountryCode } from "@/hooks/country-code"
import { twMerge } from "tailwind-merge"
import { useFormContext } from "react-hook-form"

type CheckoutAddressFields = Pick<
  HttpTypes.StoreCartAddress,
  | "first_name"
  | "last_name"
  | "address_1"
  | "address_2"
  | "company"
  | "postal_code"
  | "city"
  | "country_code"
  | "province"
  | "phone"
>

type CheckoutAddressFormValues = {
  shipping_address?: CheckoutAddressFields
  billing_address?: CheckoutAddressFields
  same_as_billing?: "on" | "off"
}

const EMPTY_CHECKOUT_ADDRESS: CheckoutAddressFields = {
  first_name: "",
  last_name: "",
  address_1: "",
  address_2: "",
  company: "",
  postal_code: "",
  city: "",
  country_code: "",
  province: "",
  phone: "",
}

const isBillingAddressEmpty = (formData: CheckoutAddressFormValues) => {
  return (
    !formData?.billing_address?.first_name &&
    !formData?.billing_address?.last_name &&
    !formData?.billing_address?.address_1 &&
    !formData?.billing_address?.address_2 &&
    !formData?.billing_address?.company &&
    !formData?.billing_address?.postal_code &&
    !formData?.billing_address?.city &&
    !formData?.billing_address?.country_code &&
    !formData?.billing_address?.province &&
    !formData?.billing_address?.phone
  )
}

const BillingAddress = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const countryCode = useCountryCode()

  const { setValue, watch } = useFormContext<CheckoutAddressFormValues>()

  const populateBillingAddress = (address?: CheckoutAddressFields) => {
    if (address) {
      setValue("billing_address", {
        first_name: address?.first_name || "",
        last_name: address?.last_name || "",
        address_1: address?.address_1 || "",
        company: address?.company || "",
        postal_code: address?.postal_code || "",
        city: address?.city || "",
        country_code: address?.country_code || "",
        province: address?.province || "",
        phone: address?.phone || "",
      })
    }
  }
  const formData = watch()
  const currentBillingAddress = formData.billing_address ?? EMPTY_CHECKOUT_ADDRESS
  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region],
  )
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code),
      ),
    [customer?.addresses, countriesInRegion],
  )
  useEffect(() => {
    // Ensure cart is not null and has a billing_address before setting form data
    if (cart) {
      if (cart.billing_address) {
        populateBillingAddress(cart.billing_address)
      } else if (
        // If customer has saved addresses in the region and form data is empty
        // set the first address in the region as the form data
        customer &&
        addressesInRegion &&
        addressesInRegion.length &&
        isBillingAddressEmpty(formData)
      ) {
        const defaultBillingAddress =
          addressesInRegion.find((a) => a.is_default_billing) || addressesInRegion[0]!

        populateBillingAddress({
          first_name: defaultBillingAddress.first_name ?? "",
          last_name: defaultBillingAddress.last_name ?? "",
          address_1: defaultBillingAddress.address_1 ?? "",
          address_2: defaultBillingAddress.address_2 ?? "",
          company: defaultBillingAddress.company ?? "",
          postal_code: defaultBillingAddress.postal_code ?? "",
          city: defaultBillingAddress.city ?? "",
          country_code: defaultBillingAddress.country_code ?? "",
          province: defaultBillingAddress.province ?? "",
          phone: defaultBillingAddress.phone ?? "",
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, customer, addressesInRegion])

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && !isBillingAddressEmpty(formData) ? (
        <div className="w-full border border-grayscale-200 rounded-xs p-4 flex flex-wrap gap-8 max-lg:flex-col mt-8">
          <div className="flex flex-1 gap-8">
            <Icon name="user" className="w-6 h-6 mt-2.5" />
            <address className="flex flex-col gap-8 flex-1 not-italic">
              <div className="flex flex-wrap justify-between gap-6">
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">Country</p>
                  <p>
                    {cart?.region?.countries?.find(
                      (c) => c.iso_2 === formData.billing_address?.country_code,
                    )?.display_name || formData.billing_address?.country_code}
                  </p>
                </div>
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">Address</p>
                  <p>{formData.billing_address?.address_1}</p>
                </div>
              </div>
              {formData.billing_address?.address_2 && (
                <div>
                  <p className="text-xs text-grayscale-500 mb-1.5">
                    Apartment, suite, etc. (Optional)
                  </p>
                  <p>{formData.billing_address?.address_2}</p>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-6">
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">Postal Code</p>
                  <p>{formData.billing_address?.postal_code}</p>
                </div>
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">City</p>
                  <p>{formData.billing_address?.city}</p>
                </div>
              </div>
            </address>
          </div>
          <UiDialogTrigger>
            <Button variant="outline" size="sm" className="shrink-0">
              Change
            </Button>
            <UiModalOverlay>
              <UiModal>
                <UiDialog aria-label="Change billing address">
                  <h3 className="text-md mb-10">Change address</h3>
                  <ReactAria.RadioGroup
                    className="flex flex-col gap-4 mb-10"
                    aria-label="Saved billing addresses"
                    onChange={(value) => {
                      const selectedAddress = addressesInRegion?.find((a) => a.id === value)
                      if (selectedAddress) {
                        populateBillingAddress({
                          address_1: selectedAddress.address_1 ?? "",
                          address_2: selectedAddress.address_2 ?? "",
                          city: selectedAddress.city ?? "",
                          company: selectedAddress.company ?? "",
                          country_code: selectedAddress.country_code ?? "",
                          first_name: selectedAddress.first_name ?? "",
                          last_name: selectedAddress.last_name ?? "",
                          phone: selectedAddress.phone ?? "",
                          postal_code: selectedAddress.postal_code ?? "",
                          province: selectedAddress.province ?? "",
                        })
                      }
                    }}
                    value={
                      addressesInRegion?.find((a) =>
                        compareAddresses(
                          {
                            first_name: a.first_name ?? "",
                            last_name: a.last_name ?? "",
                            address_1: a.address_1 ?? "",
                            address_2: a.address_2 ?? "",
                            company: a.company ?? "",
                            postal_code: a.postal_code ?? "",
                            city: a.city ?? "",
                            country_code: a.country_code ?? "",
                            province: a.province ?? "",
                            phone: a.phone ?? "",
                          },
                          {
                            first_name: currentBillingAddress.first_name ?? "",
                            last_name: currentBillingAddress.last_name ?? "",
                            address_1: currentBillingAddress.address_1 ?? "",
                            address_2: currentBillingAddress.address_2 ?? "",
                            company: currentBillingAddress.company ?? "",
                            postal_code: currentBillingAddress.postal_code ?? "",
                            city: currentBillingAddress.city ?? "",
                            country_code: currentBillingAddress.country_code ?? "",
                            province: currentBillingAddress.province ?? "",
                            phone: currentBillingAddress.phone ?? "",
                          },
                        ),
                      )?.id ?? null
                    }
                  >
                    {addressesInRegion?.map((address) => (
                      <UiRadio
                        variant="outline"
                        value={address.id}
                        className="gap-4"
                        key={address.id}
                        id={address.id}
                      >
                        <UiRadioBox />
                        <UiRadioLabel>
                          {[address.first_name, address.last_name].filter(Boolean).join(" ")}
                        </UiRadioLabel>
                        <UiRadioLabel className="ml-auto text-grayscale-500 group-data-[selected=true]:font-normal">
                          {[
                            address.address_1,
                            address.address_2,
                            [address.postal_code, address.city].filter(Boolean).join(" "),
                            cart?.region?.countries?.find((c) => c.iso_2 === address.country_code)
                              ?.display_name || address.country_code,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </UiRadioLabel>
                      </UiRadio>
                    ))}
                  </ReactAria.RadioGroup>
                  <div className="flex justify-between">
                    <UiDialogTrigger>
                      <Button>Add new address</Button>
                      <UiModalOverlay>
                        <UiModal>
                          <UiDialog aria-label="Add billing address">
                            <UpsertAddressForm
                              region={cart?.region}
                              {...withDefinedProp(
                                "defaultValues",
                                countryCode ? { country_code: countryCode } : undefined,
                              )}
                            />
                          </UiDialog>
                        </UiModal>
                      </UiModalOverlay>
                    </UiDialogTrigger>
                    <UiCloseButton variant="outline">Close</UiCloseButton>
                  </div>
                </UiDialog>
              </UiModal>
            </UiModalOverlay>
          </UiDialogTrigger>
        </div>
      ) : (
        <div className={twMerge("grid grid-cols-2 gap-4 mt-8")}>
          <InputField
            placeholder="First name"
            name="billing_address.first_name"
            inputProps={{
              autoComplete: "given-name",
              "aria-label": "Billing first name",
            }}
            data-testid="billing-first-name-input"
          />
          <InputField
            placeholder="Last name"
            name="billing_address.last_name"
            inputProps={{
              autoComplete: "family-name",
              "aria-label": "Billing last name",
            }}
            data-testid="billing-last-name-input"
          />
          <InputField
            placeholder="Address"
            name="billing_address.address_1"
            inputProps={{
              autoComplete: "address-line1",
              "aria-label": "Billing address line 1",
            }}
            data-testid="billing-address-input"
          />
          <InputField
            placeholder="Company"
            name="billing_address.company"
            inputProps={{
              autoComplete: "company",
              "aria-label": "Billing company",
            }}
            data-testid="billing-company-input"
          />
          <InputField
            placeholder="Postal code"
            name="billing_address.postal_code"
            inputProps={{
              autoComplete: "postal-code",
              "aria-label": "Billing postal code",
            }}
            data-testid="billing-postal-input"
          />
          <InputField
            placeholder="City"
            name="billing_address.city"
            inputProps={{
              autoComplete: "address-level2",
              "aria-label": "Billing city",
            }}
            data-testid="billing-city-input"
          />
          <CountrySelectField
            name="billing_address.country_code"
            selectProps={{
              autoComplete: "country",
              "aria-label": "Billing country",
              ...withDefinedProp("region", cart?.region),
            }}
            data-testid="billing-country-select"
          />
          <InputField
            placeholder="State / Province"
            name="billing_address.province"
            inputProps={{ autoComplete: "address-level1", "aria-label": "Billing state or province" }}
            data-testid="billing-province-input"
          />
          <InputField
            placeholder="Phone"
            name="billing_address.phone"
            inputProps={{ autoComplete: "tel", "aria-label": "Billing phone" }}
            data-testid="billing-phone-input"
          />
        </div>
      )}
    </>
  )
}

export default BillingAddress
