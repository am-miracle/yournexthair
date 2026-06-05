import * as React from "react"
import { Metadata } from "next"
import Script from "next/script"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedLink } from "@/components/LocalizedLink"
import dynamic from "next/dynamic"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

const CheckoutSummaryWrapper = dynamic(
  () => import("@modules/checkout/components/checkout-summary-wrapper"),
  { loading: () => <></> },
)

const MobileCheckoutSummaryWrapper = dynamic(
  () => import("@modules/checkout/components/mobile-checkout-summary-wrapper"),
  { loading: () => <></> },
)
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="lazyOnload" />
      <Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />
      <Layout className="border-b border-grayscale-200 bg-white lg:hidden">
        <LayoutColumn>
          <div className="flex min-h-18 items-center justify-between gap-4 py-4">
            <LocalizedLink href="/" className="text-sm font-semibold tracking-[0.18em] uppercase">
              YourNextHair
            </LocalizedLink>
            <p className="text-sm font-semibold">Checkout</p>
          </div>
        </LayoutColumn>
      </Layout>
      <div className="w-full border-b border-grayscale-200 bg-grayscale-50 lg:hidden">
        <Layout>
          <LayoutColumn>
            <div className="py-2">
              <MobileCheckoutSummaryWrapper />
            </div>
          </LayoutColumn>
        </Layout>
      </div>
      <Layout>
        <LayoutColumn className="flex flex-col-reverse gap-10 py-8 md:py-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12 xl:gap-16">
          <div className="w-full min-w-0 flex-1 pb-8 md:pb-12 lg:max-w-2xl lg:pt-2 xl:max-w-23xl">
            <LocalizedLink
              href="/"
              className="mb-10 hidden text-sm font-semibold uppercase tracking-[0.18em] lg:inline-block"
            >
              YourNextHair
            </LocalizedLink>
            {children}
          </div>
          <div className="hidden w-full flex-1 self-start lg:block lg:max-w-[24rem] xl:max-w-116">
            <div className="fixed top-8 w-[calc(100%-3rem)] max-w-[24rem] rounded-4xl border border-grayscale-200 bg-grayscale-50 p-6 xl:top-10 xl:max-w-116 xl:p-8">
              <CheckoutSummaryWrapper />
            </div>
          </div>
        </LayoutColumn>
      </Layout>
    </>
  )
}
