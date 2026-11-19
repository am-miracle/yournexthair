import { Icon } from "@/components/Icon"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedButtonLink } from "@/components/LocalizedLink"
import { HAIR_CONSULTATION_WHATSAPP_URL } from "@lib/consultation"

export function HairConsultation() {
  return (
    <section
      id="hair-consultation"
      aria-labelledby="hair-consultation-heading"
      className="scroll-mt-24 bg-accent-soft py-10 md:py-14"
    >
      <Layout className="gap-y-6">
        <LayoutColumn className="col-span-full">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
            Let&apos;s find your perfect hair
          </p>
          <h2 id="hair-consultation-heading" className="text-md font-medium md:text-xl">
            Can&apos;t find exactly what you want?
          </h2>
        </LayoutColumn>
        <LayoutColumn className="col-span-full">
          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <div className="flex flex-col rounded-2xl bg-white/80 p-6 md:p-8">
              <h3 className="mb-2 text-sm font-medium">I know what I want</h3>
              <p className="mb-6 text-base leading-relaxed text-grayscale-700">
                Tell us the hair type, texture and length and we&apos;ll make it for you. We send
                your quote on WhatsApp.
              </p>
              <LocalizedButtonLink
                href="/custom-order"
                className="mt-auto w-full rounded-full sm:w-auto sm:self-start"
              >
                Create your own custom look
              </LocalizedButtonLink>
            </div>
            <div className="flex flex-col rounded-2xl bg-white/80 p-6 md:p-8">
              <h3 className="mb-2 text-sm font-medium">I&apos;m not sure yet</h3>
              <p className="mb-6 text-base leading-relaxed text-grayscale-700">
                Chat with us on WhatsApp for personal advice on the textures, lengths and wigs that
                suit your style.
              </p>
              <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <a
                  href={HAIR_CONSULTATION_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Book a hair consultation on WhatsApp (opens in a new tab)"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-accent px-6 py-3 text-base font-medium text-accent transition-colors hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
                >
                  Book a hair consultation
                  <Icon name="arrow-up-right" className="w-4" />
                </a>
                <p className="text-center text-xs text-grayscale-600 sm:text-left">
                  WhatsApp: 0815 619 7614
                </p>
              </div>
            </div>
          </div>
        </LayoutColumn>
      </Layout>
    </section>
  )
}
