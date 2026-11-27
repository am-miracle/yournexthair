"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { twJoin } from "tailwind-merge"
import compareAddresses from "@lib/util/compare-addresses"
import { withDefinedProp } from "@lib/util/optional-props"
import { addressesFormSchema, type AddressesFormValues, useSetShippingAddress } from "@/hooks/cart"
import { SubmitButton } from "@modules/common/components/submit-button"
import BillingAddress from "@modules/checkout/components/billing_address"
import ErrorMessage from "@modules/checkout/components/error-message"
import ShippingAddress from "@modules/checkout/components/shipping-address"
import { Button } from "@/components/Button"
import { Form } from "@/components/Forms"
import { useCustomer } from "hooks/customer"
import { checkoutCurrency } from "@lib/util/checkout-currency"
import { cityLine } from "@lib/util/address"
import { StoreCart, StoreCartAddress, StoreRegion } from "@medusajs/types"

const toFormAddress = (address?: StoreCartAddress | null) => ({
  first_name: address?.first_name ?? "",
  last_name: address?.last_name ?? "",
  company: address?.company ?? "",
  province: address?.province ?? "",
  city: address?.city ?? "",
  postal_code: address?.postal_code ?? "",
  country_code: address?.country_code ?? "",
  address_1: address?.address_1 ?? "",
  address_2: address?.address_2 ?? "",
  phone: address?.phone ?? "",
})

const Addresses = ({
  cart,
  countries,
}: {
  cart: StoreCart
  countries: NonNullable<StoreRegion["countries"]>
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const [sameAsBilling, setSameAsBilling] = React.useState(() => {
    if (cart?.shipping_address && cart?.billing_address) {
      return compareAddresses(cart.shipping_address, cart.billing_address)
    }
    return true
  })

  const { data: customer } = useCustomer()

  const toggleSameAsBilling = React.useCallback(() => {
    setSameAsBilling((prev) => !prev)
  }, [setSameAsBilling])

  const { mutate, isPending, data } = useSetShippingAddress()

  const onSubmit = (values: AddressesFormValues) => {
    mutate(values, {
      onSuccess: (data) => {
        if (isOpen && data.success && data.countryCode) {
          router.push(`/${data.countryCode}/checkout?step=shipping`, { scroll: false })
        }
      },
    })
  }
  if (!cart) {
    return null
  }

  return (
    <>
      <div className="flex justify-between mb-6 md:mb-8 border-t border-grayscale-200 pt-8 mt-8">
        <div>
          <h2 className={twJoin("transition-[font-weight] duration-75", isOpen && "font-semibold")}>
            2. Delivery details
          </h2>
        </div>
        {!isOpen && cart?.shipping_address && (
          <Button
            variant="link"
            onPress={() => {
              router.push(pathname + "?step=delivery")
            }}
          >
            Change
          </Button>
        )}
      </div>
      {isOpen ? (
        <Form
          schema={addressesFormSchema}
          onSubmit={onSubmit}
          formProps={{
            id: `email`,
          }}
          defaultValues={
            sameAsBilling
              ? {
                  shipping_address: toFormAddress(cart?.shipping_address),
                  same_as_billing: "on",
                }
              : {
                  shipping_address: toFormAddress(cart?.shipping_address),
                  same_as_billing: "off",
                  billing_address: toFormAddress(cart?.billing_address),
                }
          }
        >
          {({ watch }) => {
            const shippingData = watch("shipping_address")
            const isDisabled =
              !customer?.addresses?.length && !Object.values(shippingData).some((value) => value)
            const destination = shippingData.country_code
            const currency = destination ? checkoutCurrency(destination) : null
            return (
              <>
                <ShippingAddress
                  customer={customer || null}
                  checked={sameAsBilling}
                  onChange={toggleSameAsBilling}
                  cart={cart}
                  countries={countries}
                />

                {!sameAsBilling && <BillingAddress cart={cart} customer={customer || null} />}

                {currency && (
                  <p role="status" className="mt-4 text-sm">
                    Your order will be charged in {currency.toUpperCase()}.
                    {currency !== cart.currency_code &&
                      " Your cart totals will update when you continue."}
                  </p>
                )}

                <SubmitButton className="mt-8" isLoading={isPending} isDisabled={isDisabled}>
                  Next
                </SubmitButton>
                <ErrorMessage {...withDefinedProp("error", data?.error)} />
              </>
            )
          }}
        </Form>
      ) : cart?.shipping_address ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,10rem)_1fr] md:gap-4">
            <div className="text-grayscale-500">Shipping address</div>
            <div className="text-grayscale-600">
              {[cart.shipping_address.first_name, cart.shipping_address.last_name]
                .filter(Boolean)
                .join(" ")}
              <br />
              {[cart.shipping_address.address_1, cart.shipping_address.address_2]
                .filter(Boolean)
                .join(" ")}
              <br />
              {cityLine(cart.shipping_address)}
              <br />
              {cart.shipping_address.country_code?.toUpperCase()}
              <br />
              {cart.shipping_address.phone}
            </div>
          </div>
          {sameAsBilling || cart.billing_address ? (
            <div className="grid gap-2 md:grid-cols-[minmax(0,10rem)_1fr] md:gap-4">
              <div className="text-grayscale-500">Billing address</div>
              <div className="text-grayscale-600">
                {sameAsBilling ? (
                  "Same as shipping address"
                ) : (
                  <>
                    {[cart.billing_address?.first_name, cart.billing_address?.last_name]
                      .filter(Boolean)
                      .join(" ")}
                    <br />
                    {[cart.billing_address?.address_1, cart.billing_address?.address_2]
                      .filter(Boolean)
                      .join(" ")}
                    <br />
                    {cityLine(cart.billing_address)}
                    <br />
                    {cart.billing_address?.country_code?.toUpperCase()}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export default Addresses
