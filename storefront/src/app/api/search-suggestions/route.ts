import { NextRequest, NextResponse } from "next/server"
import type { HttpTypes } from "@medusajs/types"
import { sdk } from "@lib/config"
import { searchClient, MeiliSearchProductHit } from "@lib/search-client"
import type { SearchSuggestionItem } from "@lib/search-suggestions"
import { getProductPrice } from "@lib/util/get-product-price"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? ""
  const regionId = request.nextUrl.searchParams.get("region")?.trim() ?? ""

  if (!query || !regionId) {
    return NextResponse.json({ items: [] satisfies SearchSuggestionItem[] })
  }

  const results = await searchClient
    .index("products")
    .search<MeiliSearchProductHit>(query, undefined, {
      signal: request.signal,
    })

  if (!results.hits.length) {
    return NextResponse.json({ items: [] satisfies SearchSuggestionItem[] })
  }

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>("/store/products", {
    query: {
      id: results.hits.map((hit) => hit.id),
      region_id: regionId,
      fields: "*variants.calculated_price,+variants.inventory_quantity",
    } satisfies HttpTypes.StoreProductListParams,
    cache: "no-store",
    signal: request.signal,
  })

  const productsById = new Map(products.map((product) => [product.id, product]))

  const items: SearchSuggestionItem[] = results.hits.map((hit) => {
    const product = productsById.get(hit.id)

    return {
      ...hit,
      price: product ? getProductPrice({ product }).cheapestPrice : null,
    }
  })

  return NextResponse.json({ items })
}
