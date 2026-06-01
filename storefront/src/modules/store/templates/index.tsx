import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { CollectionsSlider } from "@modules/store/components/collections-slider"

import { getCollectionsList } from "@lib/data/collections"
import { getCategoriesList } from "@lib/data/categories"
import { getProductTypesList } from "@lib/data/product-types"
import { withDefinedProp } from "@lib/util/optional-props"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { getRegion } from "@lib/data/regions"

const StoreTemplate = async ({
  sortBy,
  collection,
  category,
  type,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  collection?: string[]
  category?: string[]
  type?: string[]
  page?: string
  countryCode: string
}) => {
  const pageNumber = page ? parseInt(page, 10) : 1

  const [collections, categories, types, region] = await Promise.all([
    getCollectionsList(0, 100, ["id", "title", "handle"]),
    getCategoriesList(0, 100, ["id", "name", "handle"]),
    getProductTypesList(0, 100, ["id", "value"]),
    getRegion(countryCode),
  ])

  return (
    <div className="md:pt-47 py-26 md:pb-36">
      <CollectionsSlider />
      <RefinementList
        collections={Object.fromEntries(
          collections.collections.map((c) => [c.handle, c.title])
        )}
        categories={Object.fromEntries(
          categories.product_categories.map((c) => [c.handle, c.name])
        )}
        types={Object.fromEntries(
          types.productTypes.map((t) => [t.value, t.value])
        )}
        sortBy={sortBy}
        {...withDefinedProp("collection", collection)}
        {...withDefinedProp("category", category)}
        {...withDefinedProp("type", type)}
      />
      <Suspense fallback={<SkeletonProductGrid />}>
        {region && (
          <PaginatedProducts
            page={pageNumber}
            countryCode={countryCode}
            {...withDefinedProp("sortBy", sortBy)}
            {...withDefinedProp(
              "collectionId",
              collection
                ? collections.collections
                    .filter((c) => collection.includes(c.handle))
                    .map((c) => c.id)
                : undefined
            )}
            {...withDefinedProp(
              "categoryId",
              category
                ? categories.product_categories
                    .filter((c) => category.includes(c.handle))
                    .map((c) => c.id)
                : undefined
            )}
            {...withDefinedProp(
              "typeId",
              type
                ? types.productTypes
                    .filter((t) => type.includes(t.value))
                    .map((t) => t.id)
                : undefined
            )}
          />
        )}
      </Suspense>
    </div>
  )
}

export default StoreTemplate
