"use client"

import * as React from "react"
import { HAIR_CONSULTATION_WHATSAPP_URL } from "@lib/consultation"
import { SOCIAL_LINKS } from "@lib/social-links"
import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"
import { Drawer } from "@/components/Drawer"
import { LocalizedLink } from "@/components/LocalizedLink"
import { RegionSwitcher } from "@/components/RegionSwitcher"
import { SearchField } from "@/components/SearchField"
import { useCartQuantity } from "@/hooks/cart"
import { useCustomer } from "@/hooks/customer"
import { useSearchParams } from "next/navigation"

const rowClass = "flex items-center justify-between gap-4 py-3.5"

export const HeaderDrawer: React.FC<{
  countryOptions: {
    country: string
    region: string
    label: string
  }[]
  productTypes: { id: string; value: string }[]
}> = ({ countryOptions, productTypes }) => {
  const [isMenuOpenState, setIsMenuOpen] = React.useState(false)
  const { data: cartQuantity } = useCartQuantity()
  const { data: customer } = useCustomer()

  const searchParams = useSearchParams()
  const searchQuery = searchParams.get("query")

  const isMenuOpen = isMenuOpenState && !searchQuery
  const closeMenu = () => setIsMenuOpen(false)

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
            <div className="flex-1 overflow-y-auto px-6">
              <nav aria-label="Mobile" className="flex flex-col py-4 text-md">
                <LocalizedLink href="/" className={rowClass} onClick={closeMenu}>
                  Home
                </LocalizedLink>
                <LocalizedLink href="/store" className={rowClass} onClick={closeMenu}>
                  Shop all hair
                </LocalizedLink>
                {productTypes.map((productType) => (
                  <LocalizedLink
                    key={productType.id}
                    href={`/store?type=${encodeURIComponent(productType.value)}`}
                    className={rowClass}
                    onClick={closeMenu}
                  >
                    Shop {productType.value}
                  </LocalizedLink>
                ))}
                <LocalizedLink href="/custom-order" className={rowClass} onClick={closeMenu}>
                  Request a custom order
                </LocalizedLink>
                <a
                  href={HAIR_CONSULTATION_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Book a hair consultation on WhatsApp (opens in a new tab)"
                  className={rowClass}
                  onClick={closeMenu}
                >
                  Book a hair consultation
                  <Icon name="arrow-up-right" className="w-4" />
                </a>
              </nav>
              <div className="flex flex-col border-t border-grayscale-200 py-4 text-md">
                <LocalizedLink href="/cart" className={rowClass} onClick={closeMenu}>
                  Shopping cart
                  <Icon
                    name="case"
                    className="w-6 h-6"
                    {...(cartQuantity && cartQuantity > 0 ? { status: cartQuantity } : {})}
                  />
                </LocalizedLink>
                <LocalizedLink
                  href={customer ? "/account" : "/auth/login"}
                  prefetch={false}
                  className={rowClass}
                  onClick={closeMenu}
                >
                  {customer ? "My account" : "Sign in"}
                  <Icon name="user" className="w-6 h-6" />
                </LocalizedLink>
              </div>
            </div>
            <div className="flex flex-col gap-5 border-t border-grayscale-200 px-6 py-5">
              <RegionSwitcher
                countryOptions={countryOptions}
                selectButtonClassName="w-full justify-between rounded-full border border-grayscale-200 px-4 py-3 text-base"
                selectIconClassName="text-current w-6 h-6"
              />
              <ul aria-label="Social" className="flex items-center gap-6">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      className="block transition-colors hover:text-accent"
                    >
                      <Icon name={link.icon} className="w-6 h-6" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}
