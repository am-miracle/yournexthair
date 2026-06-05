import Image from "next/image"
import { getCollectionsList } from "@lib/data/collections"
import { Carousel } from "@/components/Carousel"
import { Icon } from "@/components/Icon"
import { LocalizedButtonLink, LocalizedLink } from "@/components/LocalizedLink"

export const CollectionsSection: React.FC<{ className?: string }> = async ({ className }) => {
  const collections = await getCollectionsList(0, 20, ["id", "title", "handle", "metadata"])

  if (!collections) {
    return null
  }

  return (
    <Carousel
      heading={<h3 className="text-md md:text-2xl">Collections</h3>}
      button={
        <>
          <LocalizedButtonLink
            href="/store"
            size="md"
            className="h-full flex-1 max-md:hidden md:h-auto"
          >
            View All
          </LocalizedButtonLink>
          <LocalizedButtonLink href="/store" size="sm" className="md:hidden">
            View All
          </LocalizedButtonLink>
        </>
      }
      className={className}
    >
      {collections.collections.map((collection) => (
        <div className="w-[70%] sm:w-[60%] lg:w-full max-w-124 shrink-0" key={collection.id}>
          <LocalizedLink href={`/collections/${collection.handle}`} className="group block">
            {typeof collection.metadata?.image === "object" &&
              collection.metadata.image &&
              "url" in collection.metadata.image &&
              typeof collection.metadata.image.url === "string" && (
                <div className="relative mb-4 w-full aspect-3/4 overflow-hidden bg-grayscale-100 md:mb-10">
                  <Image
                    src={collection.metadata.image.url}
                    alt={collection.title}
                    sizes="(max-width: 640px) 70vw, (max-width: 1024px) 60vw, 33vw"
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/50 via-black/15 to-transparent" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-transform duration-300 group-hover:translate-y-1 md:left-5 md:top-5">
                    <span>Explore collection</span>
                    <Icon name="arrow-up-right" className="w-3.5" />
                  </div>
                </div>
              )}
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-grayscale-200 pb-3 transition-colors duration-300 group-hover:border-black md:mb-4 md:pb-4">
              <h3 className="md:text-lg">{collection.title}</h3>
              <span className="inline-flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-grayscale-500 transition-colors duration-300 group-hover:text-black">
                Open
                <Icon
                  name="arrow-right"
                  className="w-4 transition-transform duration-300 group-hover:translate-x-1"
                />
              </span>
            </div>
            {typeof collection.metadata?.description === "string" &&
              collection.metadata?.description.length > 0 && (
                <p className="text-xs text-grayscale-500 md:text-md">
                  {collection.metadata.description}
                </p>
              )}
          </LocalizedLink>
        </div>
      ))}
    </Carousel>
  )
}
