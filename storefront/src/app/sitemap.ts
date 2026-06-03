import { MetadataRoute } from "next"
import { sdk } from "@lib/config"
import { getCollectionsList } from "@lib/data/collections"
import { getCanonicalUrl } from "@lib/util/seo"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "/",
    "/about",
    "/inspiration",
    "/store",
    "/privacy-policy",
    "/cookie-policy",
    "/terms-of-use",
  ]

  const [collections, products] = await Promise.all([
    getCollectionsList(0, 100, ["handle", "updated_at"]),
    sdk.store.product.list({ fields: "handle,updated_at" }, { next: { tags: ["products"] } }),
  ])

  return [
    ...staticRoutes.map((path) => ({
      url: getCanonicalUrl(path),
      changeFrequency: path === "/" ? "weekly" as const : "monthly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...collections.collections
      .filter((collection) => typeof collection.handle === "string" && collection.handle.length > 0)
      .map((collection) => ({
        url: getCanonicalUrl(`/collections/${collection.handle}`),
        changeFrequency: "weekly" as const,
        priority: 0.8,
        ...(collection.updated_at
          ? { lastModified: new Date(collection.updated_at) }
          : {}),
      })),
    ...products.products
      .filter((product) => typeof product.handle === "string" && product.handle.length > 0)
      .map((product) => ({
        url: getCanonicalUrl(`/products/${product.handle}`),
        changeFrequency: "weekly" as const,
        priority: 0.8,
        ...(product.updated_at
          ? { lastModified: new Date(product.updated_at) }
          : {}),
      })),
  ]
}
