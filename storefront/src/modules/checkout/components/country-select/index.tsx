"use client"

import { useMemo } from "react"

import { HttpTypes } from "@medusajs/types"
import * as ReactAria from "react-aria-components"
import {
  UiSelectButton,
  UiSelectIcon,
  UiSelectListBox,
  UiSelectListBoxItem,
  UiSelectValue,
} from "@/components/ui/Select"

export type CountrySelectProps = ReactAria.SelectProps<
  Exclude<HttpTypes.StoreRegion["countries"], undefined>[number]
> & {
  region?: HttpTypes.StoreRegion
}

const CountrySelect: React.FC<CountrySelectProps> = ({
  placeholder = "Country",
  region,
  ...props
}) => {
  const countryOptions = useMemo(() => {
    if (!region) {
      return []
    }

    return (
      region.countries
        ?.flatMap((country) => {
          if (!country?.iso_2 || !country.display_name) {
            return []
          }

          return [
            {
              value: country.iso_2,
              label: country.display_name,
            },
          ]
        }) ?? []
    )
  }, [region])

  return (
    <ReactAria.Select aria-label="Select country" {...props} placeholder={placeholder}>
      <UiSelectButton className="h-14!">
        <UiSelectValue className="text-base" />
        <UiSelectIcon />
      </UiSelectButton>
      <ReactAria.Popover className="w-[--trigger-width]">
        <UiSelectListBox>
          {countryOptions.map(({ value, label }) => (
            <UiSelectListBoxItem key={value} id={value}>
              {label}
            </UiSelectListBoxItem>
          ))}
        </UiSelectListBox>
      </ReactAria.Popover>
    </ReactAria.Select>
  )
}

CountrySelect.displayName = "CountrySelect"

export default CountrySelect
