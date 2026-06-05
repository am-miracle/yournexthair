import { Metadata } from "next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Mona_Sans } from "next/font/google"
import { getBaseURL } from "@lib/util/env"
import { SITE_DESCRIPTION, SITE_NAME, getCanonicalUrl } from "@lib/util/seo"
import Providers from "@/components/Providers"

import "../styles/globals.css"
import React from "react"
import { WebMCPProvider } from "@lib/webmcp/WebMCPProvider"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: getCanonicalUrl("/"),
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

const monaSans = Mona_Sans({
  preload: true,
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  weight: "variable",
  variable: "--font-mona-sans",
})

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" className="antialiased">
      <body className={`${monaSans.className}`}>
        <Providers>
          <a
            href="#main-content"
            className="sr-only absolute left-4 top-4 z-50 rounded-xs bg-white px-4 py-2 text-sm text-black shadow-sm focus:not-sr-only"
          >
            Skip to main content
          </a>
          <main id="main-content" className="relative">
            {props.children}
          </main>
          <SpeedInsights />
          {process.env.NEXT_PUBLIC_ENABLE_WEBMCP === "true" && <WebMCPProvider />}
        </Providers>
      </body>
    </html>
  )
}
