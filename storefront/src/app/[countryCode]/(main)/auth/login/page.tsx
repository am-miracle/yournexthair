import { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"

import { getCustomer } from "@lib/data/customer"
import { LoginForm } from "@modules/auth/components/LoginForm"
import { LocalizedLink } from "@/components/LocalizedLink"
import { isValidReturnPath } from "@lib/util/order-format"

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your account",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ redirect?: string }>
}) {
  const { countryCode } = await params
  const { redirect: requested } = await searchParams
  const returnPath = isValidReturnPath(requested, countryCode) ? requested : `/${countryCode}/account`
  const customer = await getCustomer().catch(() => null)

  if (customer) {
    redirect(returnPath)
  }

  return (
    <div className="flex min-h-screen">
      <Image
        src="/images/content/short-wig.jpg"
        width={1440}
        height={1632}
        alt="YourNextHair"
        className="max-lg:hidden lg:w-1/2 shrink-0 object-cover"
      />
      <div className="shrink-0 max-w-100 lg:max-w-96 w-full mx-auto pt-30 lg:pt-37 pb-16 max-sm:px-4">
        <h1 className="text-xl md:text-2xl mb-10 md:mb-16">Welcome back to YourNextHair</h1>
        <LoginForm className="mb-10 md:mb-15" redirectUrl={returnPath} />
        <p className="text-grayscale-500">
          Don&apos;t have an account yet? You can{" "}
          <LocalizedLink href="/auth/register" variant="underline" className="text-black md:pb-0.5">
            register here
          </LocalizedLink>
          .
        </p>
      </div>
    </div>
  )
}
