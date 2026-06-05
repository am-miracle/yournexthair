import { Metadata } from "next"
import Image from "next/image"
import { getRegion } from "@lib/data/regions"
import { getProductTypesList } from "@lib/data/product-types"
import { SITE_DESCRIPTION, getCanonicalPath } from "@lib/util/seo"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedLink } from "@/components/LocalizedLink"
import { CollectionsSection } from "@/components/CollectionsSection"
import { Icon } from "@/components/Icon"

export const metadata: Metadata = {
  title: "Raw & Virgin Hair Extensions and Wigs",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: getCanonicalPath("/"),
  },
}

const ProductTypesSection: React.FC = async () => {
  const productTypes = await getProductTypesList(0, 20, ["id", "value", "metadata"])

  if (!productTypes) {
    return null
  }

  return (
    <Layout className="mb-26 md:mb-36">
      <LayoutColumn>
        <h3 className="text-md md:text-2xl mb-8 md:mb-15">Shop by category</h3>
      </LayoutColumn>
      <LayoutColumn className="col-span-full">
        <div className="flex items-start gap-x-3 gap-y-8 md:gap-x-10 md:gap-y-12">
          {productTypes.productTypes.map((productType, index) => (
            <div key={productType.id} className="w-full">
              <LocalizedLink
                href={`/store?type=${productType.value}`}
                className="group block"
              >
                {typeof productType.metadata?.image === "object" &&
                  productType.metadata.image &&
                  "url" in productType.metadata.image &&
                  typeof productType.metadata.image.url === "string" && (
                    <div className="relative mb-4 overflow-hidden bg-grayscale-100 md:mb-6">
                      <Image
                        src={productType.metadata.image.url}
                        width={1200}
                        height={900}
                        alt={productType.value}
                        preload={index === 0}
                        loading={index === 0 ? "eager" : "lazy"}
                        className="h-64 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] sm:h-72 md:h-80 lg:h-96"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/45 via-black/10 to-transparent" />
                      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-transform duration-300 group-hover:translate-y-1 md:left-5 md:top-5">
                        <span>Shop category</span>
                        <Icon name="arrow-up-right" className="w-3.5" />
                      </div>
                    </div>
                  )}
                <div className="flex items-center justify-between gap-3 border-b border-grayscale-200 pb-3 transition-colors duration-300 group-hover:border-black md:pb-4">
                  <p className="text-xs md:text-md">{productType.value}</p>
                  <span className="inline-flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-grayscale-500 transition-colors duration-300 group-hover:text-black">
                    Explore
                    <Icon
                      name="arrow-right"
                      className="w-4 transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </LocalizedLink>
            </div>
          ))}
        </div>
      </LayoutColumn>
    </Layout>
  )
}

export default async function Home({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  return (
    <>
      <div className="relative pt-18 md:pt-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/images/content/yournexthairvideo-poster.jpg"
          aria-hidden="true"
          className="h-128 w-full object-cover sm:h-144 md:h-screen"
        >
          <source src="/images/content/yournexthairvideo.webm" type="video/webm" />
          <source src="/images/content/yournexthairvideo-web.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 px-4 sm:px-6 md:bottom-10 md:px-16 lg:px-24">
          <p className="mb-3 text-xs uppercase tracking-widest text-white/70 md:text-sm">
            Raw. Virgin. Donor.
          </p>
          <h1 className="max-w-xl text-3xl font-medium leading-tight text-white sm:text-4xl md:max-w-2xl md:text-5xl lg:text-6xl">
            Hair that starts at the source
          </h1>
          <LocalizedLink
            href="/store"
            className="inline-block mt-5 border-b border-white/60 pb-0.5 text-sm text-white transition-colors hover:border-white md:mt-6 md:text-md"
          >
            Shop now
          </LocalizedLink>
        </div>
      </div>
      <div className="pt-8 pb-26 md:pt-26 md:pb-36">
        <Layout className="mb-26 md:mb-36">
          <LayoutColumn start={1} end={{ base: 13, md: 8 }}>
            <h3 className="text-md max-md:mb-6 md:text-2xl">
              Raw and Virgin Hair, Direct from the Donor
            </h3>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 9 }} end={13}>
            <div className="flex items-center h-full">
              <div className="md:text-md">
                <p>Bundles, closures, frontals, and wigs. Strictly donor hair.</p>
                <LocalizedLink href="/store" variant="underline">
                  Shop now
                </LocalizedLink>
              </div>
            </div>
          </LayoutColumn>
        </Layout>
        <ProductTypesSection />
        <CollectionsSection className="mb-22 md:mb-36" />
        <Layout>
          <LayoutColumn className="col-span-full">
            <h3 className="text-md md:text-2xl mb-8 md:mb-16">About Your Next Hair</h3>
            <Image
              src="/images/content/wigstore.jpg"
              width={2496}
              height={1400}
              alt="Gray sofa against concrete wall"
              className="w-full aspect-video object-cover mb-8 md:mb-16"
            />
          </LayoutColumn>
          <LayoutColumn start={1} end={{ base: 13, md: 7 }}>
            <h2 className="text-md md:text-2xl">
              Raw and virgin hair sourced for consistency, longevity, and natural movement.
            </h2>
          </LayoutColumn>
          <LayoutColumn start={{ base: 1, md: 8 }} end={13} className="mt-6 md:mt-19">
            <div className="md:text-md">
              <p className="mb-5 md:mb-9">
                Bundles, closures, frontals, and wigs that blend naturally and hold up with wear. No
                guesswork, no mixed hair.
              </p>
              <p className="mb-5 md:mb-3">Ships nationwide and worldwide.</p>
              <LocalizedLink href="/about" variant="underline">
                Learn more about Your Next Hair
              </LocalizedLink>
            </div>
          </LayoutColumn>
        </Layout>
      </div>
    </>
  )
}
