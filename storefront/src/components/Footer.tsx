"use client"

import { HAIR_CONSULTATION_WHATSAPP_URL } from "@lib/consultation"
import { BrandLogo } from "@/components/BrandLogo"
import { useParams, usePathname } from "next/navigation"
import { twMerge } from "tailwind-merge"
import { Layout, LayoutColumn } from "@/components/Layout"
import { NewsletterForm } from "@/components/NewsletterForm"
import { LocalizedLink } from "@/components/LocalizedLink"

export const Footer: React.FC = () => {
  const pathName = usePathname()
  const { countryCode } = useParams()
  const currentPath = pathName.split(`/${countryCode}`)[1]

  const isAuthPage = currentPath === "/register" || currentPath === "/login"

  return (
    <footer
      className={twMerge(
        "print:hidden border-t border-accent/15 bg-accent-soft py-10 text-grayscale-800 md:py-20 [&_a]:transition-colors [&_a:hover]:text-accent [&_a:focus-visible]:outline-accent",
        isAuthPage && "hidden",
      )}
    >
      <Layout>
        <LayoutColumn className="col-span-13">
          <div className="flex max-lg:flex-col justify-between md:gap-20 max-md:px-4">
            <div className="flex flex-1 max-lg:w-full max-lg:order-2 max-sm:flex-col justify-between sm:gap-30 lg:gap-20 md:items-center">
              <div className="max-w-35 md:flex-1 max-md:mb-9">
                <LocalizedLink href="/" className="mb-4 block">
                  <BrandLogo className="h-auto w-35" />
                </LocalizedLink>
                <p className="text-xs">&copy; {new Date().getFullYear()}, Your Next Hair</p>
              </div>
              <div className="flex gap-10 xl:gap-18 max-md:text-xs flex-1 justify-between lg:justify-center">
                <ul aria-label="Company" className="flex flex-col gap-6 md:gap-3.5">
                  <li>
                    <LocalizedLink href="/store">Shop</LocalizedLink>
                  </li>
                  <li>
                    <LocalizedLink href="/custom-order">Custom orders</LocalizedLink>
                  </li>
                  <li>
                    <a
                      href={HAIR_CONSULTATION_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Book a hair consultation on WhatsApp (opens in a new tab)"
                    >
                      Book a hair consultation
                    </a>
                  </li>
                </ul>
                <ul aria-label="Social" className="flex flex-col gap-6 md:gap-3.5">
                  <li>
                    <a
                      href="https://www.instagram.com/yournexthair/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Visit Your Next Hair on Instagram"
                    >
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.facebook.com/1412930315494374"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Visit Your Next Hair on Facebook"
                    >
                      Facebook
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://api.whatsapp.com/send?phone=2348156197614"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Chat with Your Next Hair on WhatsApp"
                    >
                      WhatsApp
                    </a>
                  </li>
                </ul>
                <ul aria-label="Legal" className="flex flex-col gap-6 md:gap-3.5">
                  <li>
                    <LocalizedLink href="/refund-policy">Refund Policy</LocalizedLink>
                  </li>
                  <li>
                    <LocalizedLink href="/privacy-policy">Privacy Policy</LocalizedLink>
                  </li>
                  <li>
                    <LocalizedLink href="/cookie-policy">Cookie Policy</LocalizedLink>
                  </li>
                  <li>
                    <LocalizedLink href="/terms-of-use">Terms of Use</LocalizedLink>
                  </li>
                </ul>
              </div>
            </div>

            <NewsletterForm className="flex-1 max-lg:w-full lg:max-w-90 xl:max-w-96 max-lg:order-1 max-md:mb-16" />
          </div>
        </LayoutColumn>
      </Layout>
    </footer>
  )
}
