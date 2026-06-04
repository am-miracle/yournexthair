import { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getCollectionByHandle,
  getCollectionsList,
} from "@lib/data/collections"
import { listStaticCountryCodes } from "@lib/data/regions"
import { SITE_NAME, getCanonicalPath, getCanonicalUrl } from "@lib/util/seo"
import { withDefinedProp } from "@lib/util/optional-props"
import { StoreCollection } from "@medusajs/types"
import CollectionTemplate from "@modules/collections/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { collectionMetadataCustomFieldsSchema } from "@lib/util/collections"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<{
    category?: string | string[]
    type?: string | string[]
    page?: string
    sortBy?: SortOptions
  }>
}

export async function generateStaticParams() {
  const { collections } = await getCollectionsList()

  if (!collections) {
    return []
  }

  const countryCodes = await listStaticCountryCodes()

  const collectionHandles = collections.map(
    (collection: StoreCollection) => collection.handle
  )

  const staticParams = countryCodes
    ?.map((countryCode: string) =>
      collectionHandles.map((handle: string | undefined) => ({
        countryCode,
        handle,
      }))
    )
    .flat()

  return staticParams
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params

  const collection = await getCollectionByHandle(handle, [
    "id",
    "title",
    "metadata",
  ])

  if (!collection) {
    notFound()
  }

  const collectionDetails = collectionMetadataCustomFieldsSchema.safeParse(
    collection.metadata ?? {}
  )

  const metadata = {
    title: collection.title,
    description:
      collectionDetails.success && collectionDetails.data.description
        ? collectionDetails.data.description
        : `${collection.title} collection`,
    alternates: {
      canonical: getCanonicalPath(`/collections/${handle}`),
    },
    openGraph: {
      title: `${collection.title} | ${SITE_NAME}`,
      description:
        collectionDetails.success && collectionDetails.data.description
          ? collectionDetails.data.description
          : `${collection.title} collection`,
      url: getCanonicalUrl(`/collections/${handle}`),
      ...(collectionDetails.success &&
      collectionDetails.data.collection_page_image &&
      typeof collectionDetails.data.collection_page_image.url === "string"
        ? { images: [collectionDetails.data.collection_page_image.url] }
        : {}),
    },
  } as Metadata

  return metadata
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle, countryCode } = await params
  const { sortBy, page, category, type } = await searchParams

  const collection = await getCollectionByHandle(handle, [
    "id",
    "title",
    "metadata",
  ])

  if (!collection) {
    notFound()
  }

  return (
    <CollectionTemplate
      collection={collection}
      countryCode={countryCode}
      {...withDefinedProp("page", page)}
      {...withDefinedProp("sortBy", sortBy)}
      {...withDefinedProp(
        "category",
        !category ? undefined : Array.isArray(category) ? category : [category]
      )}
      {...withDefinedProp("type", !type ? undefined : Array.isArray(type) ? type : [type])}
    />
  )
}
