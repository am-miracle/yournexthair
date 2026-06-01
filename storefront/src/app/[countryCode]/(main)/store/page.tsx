import { Metadata } from "next"

import { withDefinedProp } from "@lib/util/optional-props"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Store",
  description: "Explore all of our products.",
}

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
