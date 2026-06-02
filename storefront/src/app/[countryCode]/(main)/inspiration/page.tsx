import { Metadata } from "next"
import Image from "next/image"
import { StoreRegion } from "@medusajs/types"
import { listRegions } from "@lib/data/regions"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedLink } from "@/components/LocalizedLink"
import { CollectionsSection } from "@/components/CollectionsSection"

export const metadata: Metadata = {
  title: "Hair Guide",
  description: "Your guide to raw and virgin donor hair, textures, origins, and how to choose.",
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

export default function InspirationPage() {
  return (
    <>
      <div className="max-md:pt-18">
        <Image
          src="/images/content/living-room-dark-green-three-seater-sofa.png"
          width={2880}
          height={1500}
          alt="Your Next Hair Guide"
          className="md:h-screen md:object-cover mb-8 md:mb-26"
        />
      </div>
      <div className="pb-26 md:pb-36">
        <Layout>
          <LayoutColumn start={1} end={{ base: 13, md: 8 }}>
            <h3 className="text-md mb-6 md:mb-16 md:text-2xl">
              Raw vs Virgin Hair. What is the difference?
            </h3>
            <div className="md:text-md max-md:mb-16 max-w-135">
              <p>
                Raw hair is collected directly from a single donor with the
                cuticles intact and fully aligned. Virgin hair has never been
                chemically processed but may come from multiple donors. Both are
                high quality. Raw is simply the most unaltered form of donor
                hair you can get.
              </p>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 9 }} end={13}>
            <LocalizedLink href="/store?category=bundles">
              <Image
                src="/images/content/dark-gray-three-seater-sofa.png"
                width={768}
                height={572}
                alt="Raw donor bundles"
                className="mb-4 md:mb-6"
              />
              <div className="flex justify-between">
                <div>
                  <p className="mb-1">Raw Bundles</p>
                  <p className="text-grayscale-500 text-xs">
                    Single donor, cuticles aligned
                  </p>
                </div>
              </div>
            </LocalizedLink>
          </LayoutColumn>
          <LayoutColumn>
            <Image
              src="/images/content/living-room-brown-armchair-gray-corner-sofa.png"
              width={2496}
              height={1404}
              alt="Hair texture guide"
              className="mt-26 md:mt-36 mb-8 md:mb-26"
            />
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, md: 8 }}>
            <h3 className="text-md mb-6 md:mb-16 md:text-2xl">
              Choosing the right texture for your lifestyle.
            </h3>
            <div className="md:text-md max-md:mb-16 max-w-135">
              <p>
                Body wave and loose wave are the most versatile. They hold
                curls, lay flat, and bounce back after washing. Straight hair is
                low maintenance and blends easily with most textures. Deep wave
                and kinky curly give you maximum volume and defined patterns
                that thrive with moisture. Choose based on how much upkeep you
                want day to day.
              </p>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 9 }} end={13}>
            <LocalizedLink
              href="/store?category=closures-frontals"
              className="mb-8 md:mb-16 inline-block"
            >
              <Image
                src="/images/content/gray-three-seater-sofa.png"
                width={768}
                height={572}
                alt="Closures and frontals"
                className="mb-4 md:mb-6"
              />
              <div className="flex justify-between">
                <div>
                  <p className="mb-1">Closures &amp; Frontals</p>
                  <p className="text-grayscale-500 text-xs">
                    4x4, 5x5, 13x4, 13x6
                  </p>
                </div>
              </div>
            </LocalizedLink>
            <LocalizedLink href="/store?category=wigs">
              <Image
                src="/images/content/gray-arm-chair.png"
                width={768}
                height={572}
                alt="Wigs and units"
                className="mb-4 md:mb-6"
              />
              <div className="flex justify-between">
                <div>
                  <p className="mb-1">Wigs &amp; Units</p>
                  <p className="text-grayscale-500 text-xs">
                    Lace front, full lace, glueless
                  </p>
                </div>
              </div>
            </LocalizedLink>
          </LayoutColumn>
        </Layout>
        <Image
          src="/images/content/living-room-gray-two-seater-puffy-sofa.png"
          width={2880}
          height={1618}
          alt="Your Next Hair origins guide"
          className="md:h-screen md:object-cover mt-26 md:mt-36 mb-8 md:mb-26"
        />
        <Layout>
          <LayoutColumn start={1} end={{ base: 13, md: 8 }}>
            <h3 className="text-md mb-6 md:mb-16 md:text-2xl">
              Brazilian, Peruvian, Indian, Malaysian, Cambodian. Origins matter.
            </h3>
            <div className="md:text-md max-md:mb-16 max-w-135">
              <p>
                Brazilian is soft and full with natural body movement. Peruvian
                is lightweight with a natural luster that catches light well.
                Indian is dense and versatile with a wave pattern that holds up
                through styling. Malaysian is silky and smooth. Cambodian is
                thick and strong, great for holding styles and lasting through
                heavy wear. Choose based on your natural texture and how much
                maintenance you want to put in.
              </p>
            </div>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 9 }} end={13}>
            <LocalizedLink href="/store">
              <Image
                src="/images/content/white-two-seater-sofa.png"
                width={768}
                height={572}
                alt="Shop all hair"
                className="mb-4 md:mb-6"
              />
              <div className="flex justify-between">
                <div>
                  <p className="mb-1">Shop All Hair</p>
                  <p className="text-grayscale-500 text-xs">
                    Bundles, closures, frontals &amp; wigs
                  </p>
                </div>
              </div>
            </LocalizedLink>
          </LayoutColumn>
        </Layout>
        <CollectionsSection className="mt-26 md:mt-36" />
      </div>
    </>
  )
}
