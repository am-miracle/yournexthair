"use client"

import * as React from "react"
import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"
import { Drawer } from "@/components/Drawer"
import { LocalizedLink } from "@/components/LocalizedLink"
import { RegionSwitcher } from "@/components/RegionSwitcher"
import { SearchField } from "@/components/SearchField"
import { useSearchParams } from "next/navigation"

export const HeaderDrawer: React.FC<{
  countryOptions: {
    country: string
    region: string
    label: string
  }[]
}> = ({ countryOptions }) => {
  const [isMenuOpenState, setIsMenuOpen] = React.useState(false)

  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("query")

  const isMenuOpen = isMenuOpenState && !searchQuery

  return (
    <>
      <Button
        variant="ghost"
        className="h-10 w-10 rounded-full p-0"
        onPress={() => setIsMenuOpen(true)}
        aria-label="Open menu"
      >
        <Icon name="menu" className="w-6 h-6" wrapperClassName="w-6 h-6" />
      </Button>
      <Drawer
        animateFrom="left"
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        colorScheme="light"
        className="w-[min(100vw,24rem)] max-w-none rounded-none p-0!"
      >
        {({ close }) => (
          <>
            <div className="flex h-full flex-col text-black">
              <div className="flex w-full items-center justify-between gap-4 border-b border-grayscale-200 px-6 py-5">
                <SearchField countryOptions={countryOptions} isInputAlwaysShown />
                <button
                  onClick={close}
                  aria-label="Close menu"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-grayscale-100"
                >
                  <Icon name="close" className="w-6" />
                </button>
              </div>
              <div className="flex flex-col px-6 py-6 text-xl font-medium">
                <LocalizedLink
                  href="/store"
                  className="border-b border-grayscale-200 py-5"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Shop
                </LocalizedLink>
                <LocalizedLink
                  href="/inspiration"
                  className="border-b border-grayscale-200 py-5"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Hair Guide
                </LocalizedLink>
                <LocalizedLink
                  href="/services"
                  className="border-b border-grayscale-200 py-5"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Services
                </LocalizedLink>
                <LocalizedLink
                  href="/about"
                  className="border-b border-grayscale-200 py-5"
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </LocalizedLink>
              </div>
              <div className="mt-auto border-t border-grayscale-200 px-6 py-5">
                <RegionSwitcher
                  countryOptions={countryOptions}
                  selectButtonClassName="w-full justify-between rounded-full border border-grayscale-200 px-4 py-3 text-base"
                  selectIconClassName="text-current w-6 h-6"
                />
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  )
}
