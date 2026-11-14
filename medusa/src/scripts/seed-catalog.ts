import {
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTypesWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import type {
  ExecArgs,
  IApiKeyModuleService,
  IFulfillmentModuleService,
  IProductModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import seedRegions from "./seed-regions"

// Illustrative catalog values for local development, not verified product specifications.
const catalog = [
  {
    title: "Copper Straight Bundles",
    handle: "copper-straight-bundles",
    image: "bundle.jpg",
    category: "bundles",
    type: "Extensions",
    collection: "indian-raw",
    color: "Copper",
    ngn: 65000,
    usd: 45,
    length: 18,
  },
  {
    title: "Honey Blonde Straight Wig",
    handle: "honey-blonde-straight-wig",
    image: "wigs.jpg",
    category: "wigs",
    type: "Wigs & Units",
    collection: "brazilian-virgin",
    color: "Honey Blonde",
    ngn: 180000,
    usd: 120,
    length: 20,
  },
  {
    title: "Classic Bob Wig",
    handle: "classic-bob-wig",
    image: "short-wig.jpg",
    category: "wigs",
    type: "Wigs & Units",
    collection: "peruvian-silky",
    color: "Natural Black",
    ngn: 120000,
    usd: 80,
    length: 10,
  },
  {
    title: "Natural Straight Lace Frontal",
    handle: "natural-straight-lace-frontal",
    image: "lace-frontal.jpg",
    category: "closures-frontals",
    type: "Frontals",
    collection: "cambodian-donor",
    color: "Dark Brown",
    ngn: 85000,
    usd: 60,
    length: 18,
  },
  {
    title: "Natural Wave Closure",
    handle: "natural-wave-closure",
    image: "closure.jpg",
    category: "closures-frontals",
    type: "Closures",
    collection: "indian-raw",
    color: "Natural Black",
    ngn: 55000,
    usd: 40,
    length: 12,
  },
] as const

export default async function seedCatalog({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const products: IProductModuleService = container.resolve(Modules.PRODUCT)
  const stores: IStoreModuleService = container.resolve(Modules.STORE)
  const channels: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillment: IFulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const apiKeys: IApiKeyModuleService = container.resolve(Modules.API_KEY)
  const imageBase = new URL(
    "/images/content/",
    process.env.STOREFRONT_URL || "http://localhost:8000",
  )
  const image = (filename: string) => ({
    id: `storefront-public-${filename}`,
    url: new URL(filename, imageBase).href,
  })

  await seedRegions({ container, args })
  const [store] = await stores.listStores()
  if (!store) throw new Error("Create a Medusa store before seeding the catalog.")
  let channelId = store.default_sales_channel_id
  if (!channelId) {
    const [existing] = await channels.listSalesChannels({ name: "Default Sales Channel" })
    const channel =
      existing ??
      (
        await createSalesChannelsWorkflow(container).run({
          input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
        })
      ).result[0]
    if (!channel) throw new Error("Could not create the default sales channel.")
    channelId = channel.id
    await updateStoresWorkflow(container).run({
      input: { selector: { id: store.id }, update: { default_sales_channel_id: channelId } },
    })
  }
  for (const key of await apiKeys.listApiKeys({ type: "publishable" })) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: key.id, add: [channelId] },
    })
  }

  let [profile] = await fulfillment.listShippingProfiles({ type: "default" })
  if (!profile) {
    profile = (
      await createShippingProfilesWorkflow(container).run({
        input: { data: [{ name: "Default", type: "default" }] },
      })
    ).result[0]
  }
  if (!profile) throw new Error("Could not create a shipping profile.")

  const categoryIds = new Map<string, string>()
  for (const [handle, name] of [
    ["bundles", "Bundles"],
    ["closures-frontals", "Closures & Frontals"],
    ["wigs", "Wigs"],
  ]) {
    if (!handle || !name) continue
    const [existing] = await products.listProductCategories({ handle })
    const category =
      existing ??
      (
        await createProductCategoriesWorkflow(container).run({
          input: { product_categories: [{ handle, name, is_active: true, is_internal: false }] },
        })
      ).result[0]
    if (!category) throw new Error(`Could not create category ${name}`)
    categoryIds.set(handle, category.id)
  }

  const collections = [
    { title: "Brazilian Virgin", handle: "brazilian-virgin", image: "wigs.jpg" },
    { title: "Peruvian Silky", handle: "peruvian-silky", image: "peruvian-col.jpg" },
    { title: "Indian Raw", handle: "indian-raw", image: "india-col.avif" },
    { title: "Cambodian Donor", handle: "cambodian-donor", image: "cambodian-col.webp" },
  ]
  const collectionIds = new Map<string, string>()
  for (const entry of collections) {
    const [existing] = await products.listProductCollections({ handle: entry.handle })
    const collection =
      existing ??
      (
        await createCollectionsWorkflow(container).run({
          input: {
            collections: [
              {
                title: entry.title,
                handle: entry.handle,
                metadata: {
                  image: image(entry.image),
                  description: `Explore the ${entry.title} demo collection.`,
                  collection_page_image: image(entry.image),
                  collection_page_heading: entry.title,
                  collection_page_content:
                    "Discover bundles, wigs, and finishing pieces for your next look.",
                  product_page_heading: "Find your next look",
                  product_page_image: image(entry.image),
                  product_page_wide_image: image(entry.image),
                  product_page_cta_image: image(entry.image),
                  product_page_cta_heading: "Explore the collection",
                  product_page_cta_link: `Shop ${entry.title}`,
                },
              },
            ],
          },
        })
      ).result[0]
    if (!collection) throw new Error(`Could not create collection ${entry.title}`)
    // Older local seeds stored only a URL; collection renderers require an image ID too.
    const metadata = { ...collection.metadata }
    let repaired = false
    for (const key of [
      "image",
      "collection_page_image",
      "product_page_image",
      "product_page_wide_image",
      "product_page_cta_image",
    ]) {
      const current = metadata[key]
      if (
        current &&
        typeof current === "object" &&
        "url" in current &&
        current.url === image(entry.image).url &&
        !("id" in current)
      ) {
        metadata[key] = image(entry.image)
        repaired = true
      }
    }
    if (repaired) await products.updateProductCollections(collection.id, { metadata })
    collectionIds.set(entry.handle, collection.id)
  }

  const typeIds = new Map<string, string>()
  for (const value of ["Extensions", "Wigs & Units", "Closures", "Frontals"]) {
    const [existing] = await products.listProductTypes({ value })
    const type =
      existing ??
      (
        await createProductTypesWorkflow(container).run({
          input: {
            product_types: [
              {
                value,
                metadata: { image: image(value === "Extensions" ? "bundle.jpg" : "wigs.jpg") },
              },
            ],
          },
        })
      ).result[0]
    if (!type) throw new Error(`Could not create product type ${value}`)
    typeIds.set(value, type.id)
  }

  let created = 0
  for (const entry of catalog) {
    if ((await products.listProducts({ handle: entry.handle })).length) continue
    const categoryId = categoryIds.get(entry.category)
    const collectionId = collectionIds.get(entry.collection)
    const typeId = typeIds.get(entry.type)
    if (!categoryId || !collectionId || !typeId)
      throw new Error(`Missing catalog links for ${entry.title}`)
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: entry.title,
            handle: entry.handle,
            description: `${entry.title} in ${entry.color.toLowerCase()}. Demo catalog item with illustrative pricing and specifications.`,
            status: ProductStatus.PUBLISHED,
            thumbnail: image(entry.image).url,
            images: [image(entry.image)],
            category_ids: [categoryId],
            collection_id: collectionId,
            type_id: typeId,
            shipping_profile_id: profile.id,
            sales_channels: [{ id: channelId }],
            metadata: {
              demo_catalog: true,
              hair_origin:
                entry.collection === "indian-raw"
                  ? "Indian"
                  : entry.collection === "peruvian-silky"
                    ? "Peruvian"
                    : entry.collection === "cambodian-donor"
                      ? "Cambodian"
                      : "Brazilian",
              hair_family: "Processed",
              texture: entry.type === "Closures" ? "Body Wave" : "Straight",
              color: entry.color,
              length_in_inches: entry.length,
              fulfillment_mode: "ready_to_ship",
              ...(entry.type !== "Extensions"
                ? { lace_size: entry.type === "Closures" ? "4x4" : "13x4", lace_type: "Regular" }
                : {}),
              ...(entry.type === "Wigs & Units"
                ? { cap_construction: "Lace Front", density: 150 }
                : {}),
            },
            options: [
              { title: "Length", values: [String(entry.length), String(entry.length + 2)] },
            ],
            variants: [0, 2].map((extra) => ({
              title: `${entry.length + extra} inches`,
              sku: `DEMO-${entry.handle.toUpperCase()}-${entry.length + extra}`,
              manage_inventory: false,
              options: { Length: String(entry.length + extra) },
              prices: [
                { currency_code: "ngn", amount: entry.ngn + extra * 5000 },
                { currency_code: "usd", amount: entry.usd + extra * 5 },
              ],
            })),
          },
        ],
      },
    })
    created++
  }
  logger.info(
    `Catalog ready: ${created} products created, ${catalog.length - created} existing products preserved; 3 categories, 4 collections, 4 product types ensured.`,
  )
}
