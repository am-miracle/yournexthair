"use client"

import * as React from "react"
import * as ReactAria from "react-aria-components"
import { twJoin } from "tailwind-merge"
import { useAsyncList } from "react-stately"
import { useRouter, useSearchParams } from "next/navigation"
import { useCountryCode } from "@/hooks/country-code"
import type { SearchSuggestionItem } from "@lib/search-suggestions"
import Thumbnail from "@modules/products/components/thumbnail"
import { Button } from "@/components/Button"
import { Input } from "@/components/Forms"
import { Icon } from "@/components/Icon"

export const SearchField: React.FC<{
  countryOptions: {
    country: string | undefined
    region: string
    label: string | undefined
  }[]
  isInputAlwaysShown?: boolean
}> = ({ countryOptions, isInputAlwaysShown }) => {
  const router = useRouter()
  const [isInputShown, setIsInputShown] = React.useState(isInputAlwaysShown ?? false)
  const countryCode = useCountryCode()
  const region = countryOptions.find((co) => co.country === countryCode)?.region
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("query")
  const [inputValue, setInputValue] = React.useState(searchQuery ?? "")

  const list = useAsyncList<SearchSuggestionItem>({
    getKey(item) {
      return item.handle
    },
    load: async ({ filterText, signal }) => {
      const normalizedFilterText = filterText?.trim() ?? ""

      if (!normalizedFilterText || !region) {
        return {
          items: [],
          filterText: filterText ?? "",
        }
      }

      const params = new URLSearchParams({
        query: normalizedFilterText,
        region,
      })

      const response = await fetch(`/api/search-suggestions?${params.toString()}`, {
        cache: "no-store",
        signal,
      })

      if (!response.ok) {
        throw new Error("Failed to load search suggestions")
      }

      const data = (await response.json()) as {
        items: SearchSuggestionItem[]
      }

      return {
        items: data.items,
        filterText: filterText ?? "",
      }
    },
    initialFilterText: searchQuery ?? "",
  })

  const buttonPressHandle = React.useCallback(() => {
    if (!isInputShown) {
      setIsInputShown(true)
    } else if (inputValue.trim()) {
      router.push(`/${countryCode}/search?query=${inputValue.trim()}`)
      if (!isInputAlwaysShown) setIsInputShown(false)
    } else {
      if (!isInputAlwaysShown) setIsInputShown(false)
    }
  }, [countryCode, inputValue, isInputAlwaysShown, isInputShown, router])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isInputAlwaysShown) setIsInputShown(false)
      } else if (e.key === "Enter" && inputValue.trim()) {
        router.push(`/${countryCode}/search?query=${inputValue.trim()}`)
        if (!isInputAlwaysShown) setIsInputShown(false)
      }
    },
    [countryCode, inputValue, isInputAlwaysShown, router],
  )

  React.useEffect(() => {
    const normalizedSearchQuery = searchQuery ?? ""

    // Sync the controlled input when navigation changes the query param.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue((currentValue) =>
      currentValue === normalizedSearchQuery ? currentValue : normalizedSearchQuery
    )

    if (list.filterText !== normalizedSearchQuery) {
      list.setFilterText(normalizedSearchQuery)
    }
  }, [list, searchQuery])

  React.useEffect(() => {
    if (inputValue === list.filterText) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      list.setFilterText(inputValue)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [inputValue, list])

  return (
    <div className={twJoin("flex", isInputAlwaysShown && "w-full")}>
      <Button
        onPress={buttonPressHandle}
        variant="ghost"
        className={twJoin(
          "h-10 w-10 shrink-0 rounded-full p-0 transition-colors hover:bg-black/5",
          isInputAlwaysShown
            ? "text-black"
            : "group-data-[light=true]:md:text-white group-data-[light=true]:md:hover:bg-white/15 group-data-[sticky=true]:md:!text-black group-data-[sticky=true]:md:hover:bg-black/5",
        )}
        aria-label={
          !isInputShown
            ? "Open search"
            : inputValue.trim()
              ? "Search for products"
              : "Close search"
        }
      >
        <Icon name="search" className="w-5 h-5" />
      </Button>
      <ReactAria.ComboBox
        allowsCustomValue
        className="overflow-hidden"
        aria-label="Search"
        items={list.items}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onKeyDown={handleKeyDown}
        isDisabled={!isInputAlwaysShown && !isInputShown}
      >
        <div
          className={twJoin(
            "h-full overflow-hidden transition-[width] duration-500",
            isInputAlwaysShown ? "max-w-none" : "max-w-40 md:max-w-30",
            isInputShown ? "w-full md:w-30" : "md:w-0",
          )}
        >
          <Input
            aria-label="Search products"
            placeholder="Search products"
            hasFloatingPlaceholder={false}
            className={twJoin(
              "h-7 rounded-none border-x-0 border-t-0 border-black px-0 py-0! disabled:bg-transparent md:h-6",
              isInputAlwaysShown
                ? "ml-2 w-full"
                : "ml-2 max-md:border-0 md:ml-1 group-data-[light=true]:md:border-white group-data-[sticky=true]:md:!border-black",
            )}
          />
        </div>
        <ReactAria.Popover
          placement="bottom end"
          containerPadding={10}
          maxHeight={243}
          offset={25}
          className="max-w-90 md:max-w-95 lg:max-w-98 w-full bg-white rounded-xs border border-grayscale-200 overflow-y-scroll"
        >
          <ReactAria.ListBox className="outline-none">
            {(item: SearchSuggestionItem) => (
              <ReactAria.ListBoxItem
                className="relative after:absolute after:content-[''] after:h-px after:bg-grayscale-100 after:-bottom-px after:left-6 after:right-6 last:after:hidden mb-px flex gap-6 p-6 transition-colors hover:bg-grayscale-50"
                key={item.handle}
                id={item.handle}
                href={`/${countryCode}/products/${item.handle}`}
              >
                <Thumbnail thumbnail={item.thumbnail} size="3/4" className="w-20" />
                <div>
                  <p className="text-base font-normal">{item.title}</p>
                  <p className="text-grayscale-500 text-xs">{item.variants[0]}</p>
                </div>
                <p className="text-base font-semibold ml-auto">{item.price?.calculated_price}</p>
              </ReactAria.ListBoxItem>
            )}
          </ReactAria.ListBox>
        </ReactAria.Popover>
      </ReactAria.ComboBox>
    </div>
  )
}
