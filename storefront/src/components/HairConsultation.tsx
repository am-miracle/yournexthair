import { Icon } from "@/components/Icon"
import { Layout, LayoutColumn } from "@/components/Layout"
import { HAIR_CONSULTATION_WHATSAPP_URL } from "@lib/consultation"

export function HairConsultation() {
  return (
    <section
      id="hair-consultation"
      aria-labelledby="hair-consultation-heading"
      className="scroll-mt-24 border-y border-accent/15 bg-accent-soft py-10 md:py-14"
    >
      <Layout className="gap-y-6 items-center">
        <LayoutColumn end={{ base: 13, md: 8 }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
            Let&apos;s find your perfect hair
          </p>
          <h2 id="hair-consultation-heading" className="text-md font-medium md:text-xl">
            Not sure which hair is right for you?
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-grayscale-700">
            Get personal guidance on textures, lengths and wigs to suit your style. Chat with us on
            WhatsApp to book your hair consultation.
          </p>
        </LayoutColumn>
        <LayoutColumn start={{ base: 1, md: 8 }} className="md:justify-self-end">
          <a
            href={HAIR_CONSULTATION_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Book a hair consultation on WhatsApp (opens in a new tab)"
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-accent px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
          >
            Book a hair consultation
            <Icon name="arrow-up-right" className="w-4" />
          </a>
          <p className="mt-3 text-center text-xs text-grayscale-600">WhatsApp: 0815 619 7614</p>
        </LayoutColumn>
      </Layout>
    </section>
  )
}
