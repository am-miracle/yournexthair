import { Metadata } from "next"
import Image from "next/image"
import { listStaticCountryCodes } from "@lib/data/regions"
import { getCanonicalPath } from "@lib/util/seo"
import { Layout, LayoutColumn } from "@/components/Layout"
import { CollectionsSection } from "@/components/CollectionsSection"

export const metadata: Metadata = {
  title: "Services",
  description:
    "Professional hair services in Port Harcourt — hair installation, bone straight, silk press, hair revamp, custom wig making, and more.",
  alternates: {
    canonical: getCanonicalPath("/services"),
  },
}

export async function generateStaticParams() {
  const countryCodes = await listStaticCountryCodes()
  return countryCodes.map((countryCode) => ({ countryCode }))
}

const WHATSAPP_URL = "https://api.whatsapp.com/send?phone=2348156197614"

export default function ServicesPage() {
  return (
    <>
      <div className="relative pt-18 md:pt-0">
        <Image
          src="/images/content/wigstore.jpg"
          width={2880}
          height={1500}
          alt="Your Next Hair professional services"
          className="h-128 w-full object-cover sm:h-144 md:h-screen"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 px-4 sm:px-6 md:bottom-10 md:px-16 lg:px-24">
          <p className="mb-3 text-xs uppercase tracking-widest text-white/70 md:text-sm">
            Port Harcourt, Rivers State
          </p>
          <h1 className="max-w-xl text-3xl font-medium leading-tight text-white sm:text-4xl md:max-w-2xl md:text-5xl lg:text-6xl">
            Professional hair services, done right.
          </h1>
        </div>
      </div>

      <div className="pt-8 md:pt-26 pb-26 md:pb-36">
        <Layout>
          <LayoutColumn start={1} end={{ base: 13, lg: 7 }}>
            <h2 className="text-md max-lg:mb-6 md:text-2xl">
              From installation to full transformation, we handle every step.
            </h2>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, lg: 8 }} end={13}>
            <div className="md:text-md lg:mt-18">
              <p className="mb-5 lg:mb-9">
                At Your Next Hair, we do not just sell premium hair — we also offer a full range of
                professional hair services right here in Port Harcourt. Whether you need a fresh
                install, a bone straight press, or a complete revamp of an existing unit, our team
                handles it with care and precision.
              </p>
              <p>
                Every service uses high-quality donor hair. You can bring your own or shop from us
                and have it installed the same day.
              </p>
            </div>
          </LayoutColumn>
        </Layout>

        <Image
          src="/images/content/units.jpg"
          width={2880}
          height={1618}
          alt="Your Next Hair services"
          className="w-full aspect-video object-cover mt-26 md:mt-36 mb-8 md:mb-26"
        />

        <Layout>
          <LayoutColumn start={1} end={{ base: 13, md: 8 }}>
            <p className="mb-4 text-xs uppercase tracking-widest text-grayscale-500">01</p>
            <h2 className="text-md mb-6 md:mb-10 md:text-2xl">Hair Installation</h2>
            <div className="md:text-md max-md:mb-16 max-w-135">
              <p className="mb-5 md:mb-8">
                Full lace wig application, sew-in weave, and frontal or closure attachment with a
                professional finish. We secure, blend, and style your unit for a natural,
                long-lasting look that moves with you.
              </p>
              <ul className="space-y-2 text-sm text-grayscale-600 md:text-base">
                <li>Wig application &amp; glue-free install</li>
                <li>Sew-in weave &amp; braid down</li>
                <li>Frontal &amp; closure attachment</li>
                <li>Baby hair &amp; edge styling</li>
              </ul>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 9 }} end={13}>
            <Image
              src="/images/content/lace-frontal.jpg"
              width={768}
              height={1024}
              alt="Lace frontal installation"
              className="w-full object-cover aspect-3/4"
            />
          </LayoutColumn>
        </Layout>

        <Layout className="mt-26 md:mt-36">
          <LayoutColumn start={{ base: 1, md: 6 }} end={13} className="md:row-start-1 self-center">
            <div className="max-w-135 md:ml-auto">
              <p className="mb-4 text-xs uppercase tracking-widest text-grayscale-500">02</p>
              <h2 className="text-md mb-6 md:mb-10 md:text-2xl">
                Bone Straight &amp; Silk Press
              </h2>
              <div className="md:text-md max-md:mb-16">
                <p className="mb-5 md:mb-8">
                  Achieve a flawless, glass-smooth finish with our professional straightening
                  service. Suitable for extensions and natural hair. We use heat protectant and
                  premium tools to deliver lasting results without damage.
                </p>
                <ul className="space-y-2 text-sm text-grayscale-600 md:text-base">
                  <li>Keratin-style bone straight press</li>
                  <li>Silk press for natural hair</li>
                  <li>Heat protection treatment</li>
                  <li>Finishing &amp; shine serum</li>
                </ul>
              </div>
            </div>
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, md: 5 }} className="md:row-start-1">
            <Image
              src="/images/content/bone-straight.jpg"
              width={768}
              height={1024}
              alt="Bone straight hair styling"
              className="w-full object-cover aspect-3/4"
            />
          </LayoutColumn>
        </Layout>

        <Image
          src="/images/content/wigs&unit.jpg"
          width={2880}
          height={1618}
          alt="Your Next Hair wigs and units"
          className="w-full aspect-video object-cover mt-26 md:mt-36 mb-8 md:mb-26"
        />

        <Layout>
          <LayoutColumn start={1} end={{ base: 13, md: 8 }}>
            <p className="mb-4 text-xs uppercase tracking-widest text-grayscale-500">03</p>
            <h2 className="text-md mb-6 md:mb-10 md:text-2xl">Hair Revamp</h2>
            <div className="md:text-md max-md:mb-16 max-w-135">
              <p className="mb-5 md:mb-8">
                Breathe new life into an old unit. We deep cleanse, recondition, detangle, and
                restyle your existing hair extensions or wig so they look and feel brand new again.
                No need to replace what can be restored.
              </p>
              <ul className="space-y-2 text-sm text-grayscale-600 md:text-base">
                <li>Deep cleanse &amp; conditioning</li>
                <li>Detangle &amp; strand restoration</li>
                <li>Restyling &amp; finishing</li>
                <li>Bleached knot refresh</li>
              </ul>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 9 }} end={13}>
            <Image
              src="/images/content/short-wig.jpg"
              width={768}
              height={1024}
              alt="Hair revamp and restoration service"
              className="w-full object-cover aspect-3/4"
            />
          </LayoutColumn>
        </Layout>

        <Layout className="mt-26 md:mt-36">
          <LayoutColumn start={{ base: 1, md: 6 }} end={13} className="md:row-start-1 self-center">
            <div className="max-w-135 md:ml-auto">
              <p className="mb-4 text-xs uppercase tracking-widest text-grayscale-500">04</p>
              <h2 className="text-md mb-6 md:mb-10 md:text-2xl">Custom Wig Making</h2>
              <div className="md:text-md max-md:mb-16">
                <p className="mb-5 md:mb-8">
                  We construct custom wig units from your chosen bundles, closures, or frontals.
                  From cap construction to install-ready finish, every detail is built around your
                  head shape, lifestyle, and desired look.
                </p>
                <ul className="space-y-2 text-sm text-grayscale-600 md:text-base">
                  <li>Custom cap construction</li>
                  <li>Closure &amp; frontal sewing</li>
                  <li>Plucking &amp; bleaching knots</li>
                  <li>Unit finishing &amp; styling</li>
                </ul>
              </div>
            </div>
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, md: 5 }} className="md:row-start-1">
            <Image
              src="/images/content/wigs.jpg"
              width={768}
              height={1024}
              alt="Custom wig making service"
              className="w-full object-cover aspect-3/4"
            />
          </LayoutColumn>
        </Layout>

        <Layout className="mt-26 md:mt-36">
          <LayoutColumn>
            <h2 className="text-md mb-10 md:mb-16 md:text-2xl">More ways we can help.</h2>
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, md: 7 }}>
            <div className="border-t border-grayscale-200 pt-8 pb-16 md:pb-26">
              <p className="mb-4 text-xs uppercase tracking-widest text-grayscale-500">05</p>
              <h3 className="mb-3 text-base font-medium">
                Wig Maintenance &amp; Cleaning
              </h3>
              <p className="text-sm text-grayscale-600 md:text-base">
                Extend the life of your investment. We wash, deep condition, and restore your unit
                to keep it looking fresh and lasting longer. Regular maintenance means your hair
                goes further.
              </p>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 7 }} end={13}>
            <div className="border-t border-grayscale-200 pt-8 pb-16 md:pb-26">
              <p className="mb-4 text-xs uppercase tracking-widest text-grayscale-500">06</p>
              <h3 className="mb-3 text-base font-medium">Hair Consultation</h3>
              <p className="text-sm text-grayscale-600 md:text-base">
                Not sure which hair is right for you? Book a one-on-one consultation with our
                experts. We help you match texture, origin, density, and length to your natural
                hair and lifestyle before you spend a thing.
              </p>
            </div>
          </LayoutColumn>
        </Layout>

        <div className="relative mt-8 md:mt-0">
          <Image
            src="/images/content/ourclient.jpg"
            width={2880}
            height={1618}
            alt="Book a hair service at Your Next Hair"
            className="w-full aspect-video object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-white/70 md:text-sm">
              Get started today
            </p>
            <h2 className="mb-8 max-w-lg text-2xl font-medium leading-tight text-white sm:text-3xl md:mb-10 md:text-4xl lg:text-5xl">
              Ready to book a service?
            </h2>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Book a service on WhatsApp (opens in a new tab)"
              className="inline-flex h-12 items-center justify-center rounded-xs border border-white px-8 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black focus-visible:outline-none"
            >
              Book on WhatsApp
            </a>
          </div>
        </div>

        <CollectionsSection className="mt-26 md:mt-36" />
      </div>
    </>
  )
}
