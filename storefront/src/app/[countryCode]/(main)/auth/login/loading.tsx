import Image from "next/image"

import { LocalizedLink } from "@/components/LocalizedLink"
import { Button } from "@/components/Button"
import { Input } from "@/components/Forms"

export default async function LoginLoadingPage() {
  return (
    <div className="flex min-h-screen">
      <Image
        src="/images/content/short-wig.jpg"
        width={1440}
        height={1632}
        alt="Your Next Hair"
        className="max-lg:hidden lg:w-1/2 shrink-0 object-cover"
      />
      <div
        className="shrink-0 max-w-100 lg:max-w-96 w-full mx-auto pt-30 lg:pt-37 pb-16 max-sm:px-4"
        aria-busy="true"
        aria-live="polite"
      >
        <h1 className="text-xl md:text-2xl mb-10 md:mb-16">Welcome back to Your Next Hair</h1>
        <p className="sr-only">Loading login form</p>
        <form className="flex flex-col gap-6 md:gap-8 mb-8 md:mb-16">
          <Input
            placeholder="Email"
            name="email"
            required
            wrapperClassName="flex-1"
            autoComplete="email"
            aria-label="Email"
            disabled
          />
          <Input
            placeholder="Password"
            name="password"
            type="password"
            required
            wrapperClassName="flex-1"
            autoComplete="current-password"
            aria-label="Password"
            disabled
          />
          <LocalizedLink
            href="/auth/forgot-password"
            variant="underline"
            className="self-start !pb-0 text-grayscale-500 leading-none"
          >
            Forgot password?
          </LocalizedLink>
          <Button isLoading>Log in</Button>
        </form>
        <p className="text-grayscale-500">
          New here? You can{" "}
          <LocalizedLink
            href="/auth/register"
            variant="underline"
            className="text-black md:pb-0.5"
          >
            create your account here
          </LocalizedLink>
          .
        </p>
      </div>
    </div>
  )
}
