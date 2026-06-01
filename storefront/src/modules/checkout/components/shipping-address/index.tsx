import { HttpTypes } from "@medusajs/types"
import { useEffect, useMemo } from "react"
import * as ReactAria from "react-aria-components"

import compareAddresses from "@lib/util/compare-addresses"
import { UpsertAddressForm } from "@modules/account/components/UpsertAddressForm"
import { CountrySelectField, InputField } from "@/components/Forms"
import { UiDialogTrigger, UiDialog, UiCloseButton } from "@/components/Dialog"
import { UiModalOverlay, UiModal } from "@/components/ui/Modal"
import { UiRadio, UiRadioBox, UiRadioLabel } from "@/components/ui/Radio"
import { Icon } from "@/components/Icon"
import { Button } from "@/components/Button"
import { useCountryCode } from "@/hooks/country-code"
import {
  UiCheckbox,
  UiCheckboxBox,
  UiCheckboxIcon,
  UiCheckboxLabel,
} from "@/components/ui/Checkbox"
import { withDefinedProp } from "@lib/util/optional-props"
import { useFormContext, useWatch } from "react-hook-form"

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

const isShippingAddressEmpty = (formData: CheckoutAddressFormValues) => {
  return (
    !formData?.shipping_address?.first_name &&
    !formData?.shipping_address?.last_name &&
    !formData?.shipping_address?.address_1 &&
    !formData?.shipping_address?.address_2 &&
    !formData?.shipping_address?.company &&
    !formData?.shipping_address?.postal_code &&
    !formData?.shipping_address?.city &&
    !formData?.shipping_address?.country_code &&
    !formData?.shipping_address?.province &&
    !formData?.shipping_address?.phone
  )
}
// import AddressSelect from "../address-select"

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const countryCode = useCountryCode()

  const { setValue, control } = useFormContext<CheckoutAddressFormValues>()

  const formData = useWatch<CheckoutAddressFormValues>({ control })
  const currentShippingAddress = formData.shipping_address ?? EMPTY_CHECKOUT_ADDRESS

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const populateShippingAddress = (address?: CheckoutAddressFields) => {
    if (address) {
      setValue("shipping_address", {
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

  useEffect(() => {
    // Ensure cart is not null and has a shipping_address before setting form data
    if (cart) {
      if (cart.shipping_address) {
        populateShippingAddress(cart.shipping_address)
      } else if (
        // If customer has saved addresses in the region and form data is empty
        // set the first address in the region as the form data
        customer &&
        addressesInRegion &&
        addressesInRegion.length &&
        isShippingAddressEmpty(formData)
      ) {
        const defaultShippingAddress =
          addressesInRegion.find((a) => a.is_default_shipping) ||
          addressesInRegion[0]!

        populateShippingAddress({
          first_name: defaultShippingAddress.first_name ?? "",
          last_name: defaultShippingAddress.last_name ?? "",
          address_1: defaultShippingAddress.address_1 ?? "",
          address_2: defaultShippingAddress.address_2 ?? "",
          company: defaultShippingAddress.company ?? "",
          postal_code: defaultShippingAddress.postal_code ?? "",
          city: defaultShippingAddress.city ?? "",
          country_code: defaultShippingAddress.country_code ?? "",
          province: defaultShippingAddress.province ?? "",
          phone: defaultShippingAddress.phone ?? "",
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, customer, addressesInRegion])

  return (
    <>
      {customer &&
      (addressesInRegion?.length || 0) > 0 &&
      !isShippingAddressEmpty(formData) ? (
        <div className="w-full border border-grayscale-200 rounded-xs p-4 flex flex-wrap gap-8 max-lg:flex-col mb-8">
          <div className="flex flex-1 gap-8">
            <Icon name="user" className="w-6 h-6 mt-2.5" />
            <div className="flex flex-col gap-8 flex-1">
              <div className="flex flex-wrap justify-between gap-6">
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">Country</p>
                  <p>
                    {cart?.region?.countries?.find(
                      (c) => c.iso_2 === currentShippingAddress.country_code
                    )?.display_name || currentShippingAddress.country_code}
                  </p>
                </div>
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">Address</p>
                  <p>{currentShippingAddress.address_1}</p>
                </div>
              </div>
              {currentShippingAddress.address_2 && (
                <div>
                  <p className="text-xs text-grayscale-500 mb-1.5">
                    Apartment, suite, etc. (Optional)
                  </p>
                  <p>{currentShippingAddress.address_2}</p>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-6">
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">
                    Postal Code
                  </p>
                  <p>{currentShippingAddress.postal_code}</p>
                </div>
                <div className="grow basis-0">
                  <p className="text-xs text-grayscale-500 mb-1.5">City</p>
                  <p>{currentShippingAddress.city}</p>
                </div>
              </div>
            </div>
          </div>
          <UiDialogTrigger>
            <Button variant="outline" size="sm" className="shrink-0">
              Change
            </Button>
            <UiModalOverlay>
              <UiModal>
                <UiDialog>
                  <p className="text-md mb-10">Change address</p>
                  <ReactAria.RadioGroup
                    className="flex flex-col gap-4 mb-10"
                    aria-label="Shipping methods"
                    onChange={(value) => {
                      const selectedAddress = addressesInRegion?.find(
                        (a) => a.id === value
                      )
                      if (selectedAddress) {
                        populateShippingAddress({
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
                            first_name: currentShippingAddress.first_name ?? "",
                            last_name: currentShippingAddress.last_name ?? "",
                            address_1: currentShippingAddress.address_1 ?? "",
                            address_2: currentShippingAddress.address_2 ?? "",
                            company: currentShippingAddress.company ?? "",
                            postal_code: currentShippingAddress.postal_code ?? "",
                            city: currentShippingAddress.city ?? "",
                            country_code: currentShippingAddress.country_code ?? "",
                            province: currentShippingAddress.province ?? "",
                            phone: currentShippingAddress.phone ?? "",
                          }
                        )
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
                          {[address.first_name, address.last_name]
                            .filter(Boolean)
                            .join(" ")}
                        </UiRadioLabel>
                        <UiRadioLabel className="ml-auto text-grayscale-500 group-data-[selected=true]:font-normal">
                          {[
                            address.address_1,
                            address.address_2,
                            [address.postal_code, address.city]
                              .filter(Boolean)
                              .join(" "),
                            cart?.region?.countries?.find(
                              (c) => c.iso_2 === address.country_code
                            )?.display_name || address.country_code,
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
                          <UiDialog>
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
        <div className="grid grid-cols-2 gap-4 mb-8">
          <InputField
            placeholder="First name"
            name="shipping_address.first_name"
            inputProps={{ autoComplete: "given-name" }}
            data-testid="shipping-first-name-input"
          />
          <InputField
            placeholder="Last name"
            name="shipping_address.last_name"
            inputProps={{ autoComplete: "family-name" }}
            data-testid="shipping-last-name-input"
          />
          <InputField
            placeholder="Address"
            name="shipping_address.address_1"
            inputProps={{ autoComplete: "address-line1" }}
            data-testid="shipping-address-input"
          />
          <InputField
            placeholder="Company"
            name="shipping_address.company"
            inputProps={{ autoComplete: "organization" }}
            data-testid="shipping-company-input"
          />
          <InputField
            placeholder="Postal code"
            name="shipping_address.postal_code"
            inputProps={{ autoComplete: "postal-code" }}
            data-testid="shipping-postal-code-input"
          />
          <InputField
            placeholder="City"
            name="shipping_address.city"
            inputProps={{ autoComplete: "address-level2" }}
            data-testid="shipping-city-input"
          />
          <CountrySelectField
            name="shipping_address.country_code"
            selectProps={{
              autoComplete: "country",
              ...withDefinedProp("region", cart?.region),
            }}
            data-testid="shipping-country-select"
          />
          <InputField
            placeholder="State / Province"
            name="shipping_address.province"
            inputProps={{ autoComplete: "address-level1" }}
            data-testid="shipping-province-input"
          />
          <InputField
            placeholder="Phone"
            name="shipping_address.phone"
            inputProps={{ autoComplete: "tel" }}
            data-testid="shipping-phone-input"
          />
        </div>
      )}
      <div>
        <input
          type="hidden"
          name="same_as_billing"
          value={checked ? "on" : "off"}
        />
        <UiCheckbox
          name="same_as_billing"
          isSelected={checked}
          onChange={() => {
            setValue("same_as_billing", checked ? "off" : "on")
            onChange()
          }}
          data-testid="billing-address-checkbox"
        >
          <UiCheckboxBox>
            <UiCheckboxIcon />
          </UiCheckboxBox>
          <UiCheckboxLabel>
            Billing address same as shipping address
          </UiCheckboxLabel>
        </UiCheckbox>
      </div>
    </>
  )
}

export default ShippingAddress
