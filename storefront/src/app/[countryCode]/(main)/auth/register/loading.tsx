import Image from "next/image"
import { LocalizedLink } from "@/components/LocalizedLink"
import { Input } from "@/components/Forms"
import { SubmitButton } from "@modules/common/components/submit-button"

export default function RegisterLoadingPage() {
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
        <h1 className="text-xl md:text-2xl mb-10 md:mb-16">Create your Your Next Hair account</h1>
        <p className="sr-only">Loading registration form</p>
        <form className="flex flex-col gap-6 md:gap-8 mb-8 md:mb-16">
          <div className="flex gap-4 md:gap-6">
            <Input
              placeholder="First name"
              name="first_name"
              required
              wrapperClassName="flex-1"
              minLength={1}
              aria-label="First name"
              disabled
            />
            <Input
              placeholder="Last name"
              name="last_name"
              required
              wrapperClassName="flex-1"
              minLength={1}
              aria-label="Last name"
              disabled
            />
          </div>
          <Input
            placeholder="Email"
            name="email"
            required
            wrapperClassName="flex-1"
            type="email"
            aria-label="Email"
            disabled
          />
          <Input
            placeholder="Phone"
            name="phone"
            wrapperClassName="flex-1"
            type="tel"
            aria-label="Phone"
            disabled
          />
          <Input
            placeholder="Password"
            name="password"
            type="password"
            required
            wrapperClassName="flex-1"
            autoComplete="new-password"
            minLength={6}
            aria-label="Password"
            disabled
          />
          <Input
            placeholder="Confirm password"
            name="confirm_password"
            type="password"
            required
            wrapperClassName="flex-1"
            autoComplete="new-password"
            minLength={6}
            aria-label="Confirm password"
            disabled
          />
          <SubmitButton isLoading>Register</SubmitButton>
        </form>
        <p className="text-grayscale-500">
          Already have an account? Just{" "}
          <LocalizedLink
            href="/auth/login"
            variant="underline"
            className="text-black md:pb-0.5"
          >
            log in
          </LocalizedLink>
          .
        </p>
      </div>
    </div>
  )
}
