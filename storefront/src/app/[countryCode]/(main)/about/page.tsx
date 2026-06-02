import { Metadata } from "next"
import Image from "next/image"
import { StoreRegion } from "@medusajs/types"
import { listRegions } from "@lib/data/regions"
import { Layout, LayoutColumn } from "@/components/Layout"

export const metadata: Metadata = {
  title: "About",
  description: "Learn more about Your Next Hair, raw and virgin donor hair extensions and wigs.",
}

export async function generateStaticParams() {
  const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions.flatMap((r) =>
      r.countries
        ? r.countries
            .map((c) => c.iso_2)
            .filter(
              (value): value is string =>
                typeof value === "string" && Boolean(value)
            )
        : []
    )
  )

  const staticParams = countryCodes.map((countryCode) => ({
    countryCode,
  }))

  return staticParams
}

export default function AboutPage() {
  return (
    <>
      <div className="max-md:pt-18">
        <Image
          src="/images/content/living-room-gray-three-seater-sofa.png"
          width={2880}
          height={1500}
          alt="Your Next Hair"
          className="md:h-screen md:object-cover"
        />
      </div>
      <div className="pt-8 md:pt-26 pb-26 md:pb-36">
        <Layout>
          <LayoutColumn start={1} end={{ base: 13, lg: 7 }}>
            <h3 className="text-md max-lg:mb-6 md:text-2xl">
              At Your Next Hair, we believe great hair starts at the source.
            </h3>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, lg: 8 }} end={13}>
            <div className="md:text-md lg:mt-18">
              <p className="mb-5 lg:mb-9">
                Your Next Hair is built around one thing: raw, unprocessed donor
                hair that you can actually trust. We deal strictly in virgin and
                raw bundles, closures, frontals, and wigs sourced directly from
                real donors.
              </p>
              <p>
                No shortcuts. No blended hair. Just clean, full, lasting quality
                shipped nationwide and worldwide from Port Harcourt, Rivers
                State, Nigeria.
              </p>
            </div>
          </LayoutColumn>
          <LayoutColumn>
            <Image
              src="/images/content/living-room-black-armchair-dark-gray-sofa.png"
              width={2496}
              height={1404}
              alt="Your Next Hair collection"
              className="mt-26 lg:mt-36 mb-8 lg:mb-26"
            />
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, lg: 8 }}>
            <h3 className="text-md lg:mb-10 mb-6 md:text-2xl">
              Strictly donor hair. Nothing less, nothing mixed.
            </h3>
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, lg: 6 }}>
            <div className="mb-16 lg:mb-26">
              <p className="mb-5 md:mb-9">
                Every bundle, closure, frontal, and wig we carry is sourced from
                a single donor and never chemically processed. The cuticles are
                intact, the strands are aligned, and the hair moves exactly the
                way it should.
              </p>
              <p>
                We carry Brazilian, Peruvian, Indian, Malaysian, and Cambodian
                raw hair because texture, origin, and density matter. We stock
                what actually works.
              </p>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 2, lg: 1 }} end={{ base: 12, lg: 7 }}>
            <Image
              src="/images/content/gray-one-seater-sofa-wooden-coffee-table.png"
              width={1200}
              height={1600}
              alt="Your Next Hair quality"
              className="mb-16 lg:mb-46"
            />
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, lg: 8 }} end={13}>
            <div className="mb-6 lg:mb-20 xl:mb-36">
              <p>
                We ship nationwide across Nigeria and worldwide to the UK, US,
                Canada, Europe, the Caribbean, and beyond. Great hair is a
                global need and we are built to meet it wherever you are.
              </p>
            </div>
            <div className="md:text-md max-lg:mb-26">
              <p>
                We also accept Zelle for payment because buying quality hair
                should be straightforward with no unnecessary barriers between
                you and what you need.
              </p>
            </div>
          </LayoutColumn>
        </Layout>
        <Image
          src="/images/content/living-room-gray-three-seater-puffy-sofa.png"
          width={2880}
          height={1618}
          alt="Your Next Hair"
          className="mb-8 lg:mb-26"
        />
        <Layout>
          <LayoutColumn start={1} end={{ base: 13, lg: 7 }}>
            <h3 className="text-md max-lg:mb-6 md:text-2xl">
              Our clients are at the center of everything we do.
            </h3>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, lg: 8 }} end={13}>
            <div className="md:text-md lg:mt-18">
              <p className="mb-5 lg:mb-9">
                Whether you are a first-time buyer or a returning client, we
                take the time to make sure you get exactly what you are looking
                for. Questions? Reach us directly on{" "}
                <a
                  href="https://api.whatsapp.com/send?phone=2348156197614"
                  target="_blank"
                  className="underline"
                >
                  WhatsApp
                </a>
                .
              </p>
              <p>
                Thank you for choosing Your Next Hair. We are not just selling
                extensions. We are helping you show up exactly how you want to.
              </p>
            </div>
          </LayoutColumn>
        </Layout>
      </div>
    </>
  )
}
