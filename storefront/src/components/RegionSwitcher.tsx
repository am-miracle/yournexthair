"use client"

import { usePathname } from "next/navigation"
import * as ReactAria from "react-aria-components"
import {
  UiSelectButton,
  UiSelectIcon,
  UiSelectListBox,
  UiSelectListBoxItem,
  UiSelectValue,
} from "@/components/ui/Select"
import { withDefinedProp } from "@lib/util/optional-props"
import { useCountryCode } from "hooks/country-code"
import { useUpdateRegion } from "hooks/cart"
export const RegionSwitcher = ({
  countryOptions,
  className,
  selectButtonClassName,
  selectIconClassName,
}: {
  countryOptions: {
    country: string
    region: string
    label: string
  }[]
  className?: string
  selectButtonClassName?: string
  selectIconClassName?: string
}) => {
  const pathName = usePathname()
  const countryCode = useCountryCode(countryOptions)
  let currentPath = pathName

  const updateRegion = useUpdateRegion()

  if (countryCode) {
    currentPath = pathName.split(`/${countryCode}`)[1] ?? "/"
  }

  const selectedCountryCode = countryCode?.toUpperCase() ?? ""

  return (
    <ReactAria.Select
      value={countryCode ?? null}
      onChange={(value) => {
        if (typeof value === "string" && value.length > 0) {
          updateRegion.mutate({ countryCode: value, currentPath })
        }
      }}
      {...withDefinedProp("className", className)}
      aria-label="Select country"
    >
      <UiSelectButton
        variant="ghost"
        {...withDefinedProp("className", selectButtonClassName)}
      >
        <UiSelectValue className="min-w-[2ch] overflow-visible text-center">
          {(item) => {
            if (selectedCountryCode) {
              return selectedCountryCode
            }

            return typeof item.selectedItems[0] === "object" &&
            item.selectedItems[0] !== null &&
            "country" in item.selectedItems[0] &&
            typeof item.selectedItems[0].country === "string"
              ? item.selectedItems[0].country.toUpperCase()
              : item.defaultChildren
          }}
        </UiSelectValue>
        <UiSelectIcon className={selectIconClassName} />
      </UiSelectButton>
      <ReactAria.Popover placement="bottom right" className="max-w-61 w-full">
        <UiSelectListBox>
          {countryOptions.map((country) => (
            <UiSelectListBoxItem key={country.country} id={country.country} value={country}>
              {country.label}
            </UiSelectListBoxItem>
          ))}
        </UiSelectListBox>
      </ReactAria.Popover>
    </ReactAria.Select>
  )
}
