import { Metadata } from "next"
import { listRegions } from "@lib/data/regions"
import { getCanonicalPath } from "@lib/util/seo"
import { HAIR_CONSULTATION_WHATSAPP_URL } from "@lib/consultation"
import { Layout, LayoutColumn } from "@/components/Layout"
import { CustomOrderForm } from "@modules/custom-order/components/CustomOrderForm"

export const metadata: Metadata = {
  title: "Request a custom order",
  description:
    "Tell us about the custom raw or premium virgin hair wig you want and we'll send you a quote on WhatsApp.",
  alternates: { canonical: getCanonicalPath("/custom-order") },
}

const STEPS = [
  {
    title: "Tell us what you want",
    body: "Describe the hair or wig you have in mind. If you're not sure about the details, that's fine.",
  },
  {
    title: "Get your quote on WhatsApp",
    body: "We review your requirements, answer your questions and send you a price including delivery.",
  },
  {
    title: "We make your hair",
    body: "Once you approve the quote and pay, premium virgin hair takes 6–7 weeks and raw hair 9–12 weeks.",
  },
]

async function deliveryCountries() {
  const regions = (await listRegions()) ?? []
  const countries = new Map<string, string>()
  regions.forEach((region) =>
    region.countries?.forEach((country) => {
      if (country?.iso_2 && country.display_name) {
        countries.set(country.iso_2, country.display_name)
      }
    }),
  )
  return [...countries]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export default async function CustomOrderPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const countries = await deliveryCountries()

  return (
    <div className="pt-30 pb-26 md:pt-37 md:pb-36">
      <Layout className="gap-y-12">
        <LayoutColumn end={{ base: 13, lg: 6 }}>
          <div className="lg:sticky lg:top-32">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
              Custom orders
            </p>
            <h1 id="custom-order-heading" className="mb-4 text-xl md:text-2xl">
              Request a custom order
            </h1>
            <p className="mb-10 max-w-xl text-grayscale-700 md:text-md">
              Tell us what you have in mind. We’ll review your requirements and contact you on
              WhatsApp with a quote.
            </p>
            <ol className="flex max-w-xl flex-col gap-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-medium">{step.title}</h2>
                    <p className="text-grayscale-700">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-10 max-w-xl text-xs text-grayscale-600">
              Not sure what to ask for?{" "}
              <a
                href={HAIR_CONSULTATION_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Book a hair consultation on WhatsApp
              </a>
              .
            </p>
          </div>
        </LayoutColumn>
        <LayoutColumn start={{ base: 1, lg: 7 }} end={13}>
          <CustomOrderForm countries={countries} defaultCountry={countryCode} />
        </LayoutColumn>
      </Layout>
    </div>
  )
}
