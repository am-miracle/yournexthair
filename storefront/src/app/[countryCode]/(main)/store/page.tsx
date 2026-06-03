import { Metadata } from "next"

import { getCanonicalPath } from "@lib/util/seo"
import { withDefinedProp } from "@lib/util/optional-props"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    collection?: string | string[]
    category?: string | string[]
    type?: string | string[]
    page?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { sortBy, page, collection, category, type } = await searchParams
  const isFiltered =
    Boolean(sortBy) ||
    Boolean(collection) ||
    Boolean(category) ||
    Boolean(type) ||
    (typeof page === "string" && page !== "1")

  return {
    title: "Shop Raw & Virgin Hair",
    description: "Explore raw hair, virgin hair, bundles, closures, frontals, and wigs.",
    alternates: {
      canonical: getCanonicalPath("/store"),
    },
    ...(isFiltered
      ? {
          robots: {
            index: false,
            follow: true,
          },
        }
      : {}),
  }
}

export default async function StorePage({ searchParams, params }: Params) {
  const { countryCode } = await params
  const { sortBy, page, collection, category, type } = await searchParams

  return (
    <StoreTemplate
      countryCode={countryCode}
      {...withDefinedProp("sortBy", sortBy)}
      {...withDefinedProp("page", page)}
      {...withDefinedProp(
        "collection",
        !collection ? undefined : Array.isArray(collection) ? collection : [collection]
      )}
      {...withDefinedProp(
        "category",
        !category ? undefined : Array.isArray(category) ? category : [category]
      )}
      {...withDefinedProp("type", !type ? undefined : Array.isArray(type) ? type : [type])}
    />
  )
}
