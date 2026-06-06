import * as React from "react"
import { listRegions } from "@lib/data/regions"
import { SearchField } from "@/components/SearchField"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedLink } from "@/components/LocalizedLink"
import { HeaderDrawer } from "@/components/HeaderDrawer"
import { RegionSwitcher } from "@/components/RegionSwitcher"
import { HeaderWrapper } from "@/components/HeaderWrapper"
import { CartDrawer } from "@/components/CartDrawer"
import LoginLink from "@modules/header/components/LoginLink"

type CountryOption = {
  country: string
  region: string
  label: string
}

export const Header: React.FC = async () => {
  const regions = await listRegions()
  const navLinkClass =
    "rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 hover:text-black group-data-[light=true]:md:text-white group-data-[light=true]:md:hover:bg-white/15 group-data-[light=true]:md:hover:text-white group-data-[sticky=true]:md:!text-black group-data-[sticky=true]:md:hover:bg-black/5 group-data-[sticky=true]:md:hover:!text-black"

  const countryOptions: CountryOption[] = regions
    .flatMap((region) =>
      (region.countries ?? []).flatMap((country) =>
        country.iso_2 && country.display_name
          ? [
              {
                country: country.iso_2,
                region: region.id,
                label: country.display_name,
              },
            ]
          : [],
      ),
    )
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <HeaderWrapper>
      <header>
        <Layout>
          <LayoutColumn>
            <div className="flex h-16 items-center justify-between gap-4 md:h-20">
              <p className="shrink-0 text-sm font-semibold uppercase md:text-base">
                <LocalizedLink href="/" className="cursor-pointer rounded-full py-2">
                  YourNextHair
                </LocalizedLink>
              </p>
              <nav
                aria-label="Primary"
                className="hidden items-center rounded-full border border-transparent bg-white/0 p-1 transition-colors md:flex group-data-[light=true]:md:border-white/25 group-data-[light=true]:md:bg-white/10 group-data-[sticky=true]:md:border-grayscale-200 group-data-[sticky=true]:md:bg-grayscale-50"
              >
                <LocalizedLink href="/about" className={navLinkClass}>
                  About
                </LocalizedLink>
                <LocalizedLink href="/inspiration" className={navLinkClass}>
                  Hair Guide
                </LocalizedLink>
                <LocalizedLink href="/services" className={navLinkClass}>
                  Services
                </LocalizedLink>
                <LocalizedLink href="/store" className={navLinkClass}>
                  Shop
                </LocalizedLink>
              </nav>
              <div className="hidden items-center gap-2 md:flex lg:gap-3">
                <RegionSwitcher
                  countryOptions={countryOptions}
                  className="w-auto cursor-pointer"
                  selectButtonClassName="h-10 min-w-18 rounded-full !gap-1 !px-3 !py-0 transition-colors cursor-pointer hover:bg-black/5 group-data-[light=true]:md:text-white group-data-[light=true]:md:hover:bg-white/15 group-data-[sticky=true]:md:!text-black group-data-[sticky=true]:md:hover:bg-black/5"
                  selectIconClassName="text-current"
                />
                <React.Suspense>
                  <SearchField countryOptions={countryOptions} />
                </React.Suspense>
                <LoginLink className="h-10 w-10 rounded-full p-0 cursor-pointer transition-colors hover:bg-black/5 group-data-[light=true]:md:text-white group-data-[light=true]:md:hover:bg-white/15 group-data-[sticky=true]:md:!text-black group-data-[sticky=true]:md:hover:bg-black/5" />
                <CartDrawer />
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <LoginLink className="h-10 w-10 rounded-full p-0 cursor-pointer" />
                <CartDrawer />
                <React.Suspense>
                  <HeaderDrawer countryOptions={countryOptions} />
                </React.Suspense>
              </div>
            </div>
          </LayoutColumn>
        </Layout>
      </header>
    </HeaderWrapper>
  )
}
