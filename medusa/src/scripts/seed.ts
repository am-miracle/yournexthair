import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTypesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows"
import type {
  ExecArgs,
  IFulfillmentModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import type FashionModuleService from "../modules/fashion/service"
import type { MaterialModelType } from "../modules/fashion/models/material"

function requireDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message)
  }

  return value
}

function requireFirst<T>(values: T[], message: string): T {
  return requireDefined(values[0], message)
}

function requireFound<T>(values: T[], predicate: (value: T) => boolean, message: string): T {
  const value = values.find(predicate)

  if (!value) {
    throw new Error(message)
  }

  return value
}

async function getImageUrlContent(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch image "${url}": ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()

  return Buffer.from(arrayBuffer).toString("binary")
}

const NGN_PER_USD = 1600

type SeedPrice = {
  amount: number
  currency_code?: string
  region_id?: string
}

type SeedVariant = {
  prices?: SeedPrice[]
}

type SeedProduct = {
  variants?: SeedVariant[]
}

function appendNgnPrice(prices: SeedPrice[]): SeedPrice[] {
  if (prices.some((price) => price.currency_code === "ngn")) {
    return prices
  }

  const usdPrice = prices.find((price) => price.currency_code === "usd")

  if (!usdPrice) {
    return prices
  }

  return [
    ...prices,
    {
      amount: usdPrice.amount * NGN_PER_USD,
      currency_code: "ngn",
    },
  ]
}

function withNgnVariantPrices<T extends { products: SeedProduct[] }>(input: T): T {
  return {
    ...input,
    products: input.products.map((product) => ({
      ...product,
      variants: product.variants?.map((variant) => ({
        ...variant,
        prices: variant.prices ? appendNgnPrice(variant.prices) : variant.prices,
      })),
    })),
  }
}

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService: IFulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService: ISalesChannelModuleService = container.resolve(
    Modules.SALES_CHANNEL,
  )
  const storeModuleService: IStoreModuleService = container.resolve(Modules.STORE)
  const fashionModuleService: FashionModuleService = container.resolve("fashionModuleService")

  const nigeriaCountries = ["ng"]
  const usdCountries = [
    "us",
    "ca",
    "au",
    "gb",
    "gh",
    "ke",
    "za",
    "tz",
    "ug",
    "et",
    "eg",
    "ma",
    "jm",
    "tt",
    "bb",
    "gy",
    "bs",
    "in",
    "sg",
    "my",
    "ae",
    "sa",
    "qa",
    "nz",
  ]
  const eurCountries = ["de", "fr", "es", "it", "nl", "be", "se", "no", "dk", "fi", "ie", "pt", "ch", "at", "pl", "cz", "hu", "hr"]
  const countries = [...nigeriaCountries, ...usdCountries, ...eurCountries]

  logger.info("Seeding store data...")
  const store = requireFirst(
    await storeModuleService.listStores(),
    "Expected at least one store to exist before seeding demo data.",
  )
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    })
    defaultSalesChannel = salesChannelResult
  }
  const defaultSalesChannelId = requireFirst(
    defaultSalesChannel,
    "Expected a default sales channel to exist before seeding demo data.",
  ).id

  logger.info("Seeding region data...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Nigeria",
          currency_code: "ngn",
          countries: nigeriaCountries,
          payment_providers: ["pp_stripe_stripe"],
        },
        {
          name: "International",
          currency_code: "usd",
          countries: usdCountries,
          payment_providers: ["pp_stripe_stripe"],
        },
        {
          name: "Europe",
          currency_code: "eur",
          countries: eurCountries,
          payment_providers: ["pp_stripe_stripe"],
        },
      ],
    },
  })
  const nigeriaRegion = requireFound(regionResult, (region) => region.name === "Nigeria", 'Expected "Nigeria" region to be created while seeding demo data.')
  requireFound(regionResult, (region) => region.name === "International", 'Expected "International" region to be created while seeding demo data.')
  requireFound(regionResult, (region) => region.name === "Europe", 'Expected "Europe" region to be created while seeding demo data.')
  logger.info("Finished seeding regions.")

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "ngn",
            is_default: true,
          },
          {
            currency_code: "usd",
          },
          {
            currency_code: "eur",
          },
        ],
        default_sales_channel_id: defaultSalesChannelId,
        default_region_id: nigeriaRegion.id,
      },
    },
  })

  logger.info("Seeding tax regions...")
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
    })),
  })
  logger.info("Finished seeding tax regions.")

  logger.info("Seeding stock location data...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "Portharcourt Warehouse",
          address: {
            city: "Port harcourt",
            country_code: "NG",
            address_1: "",
          },
        },
      ],
    },
  })
  const stockLocation = requireFirst(
    stockLocationResult,
    "Expected a stock location to be created while seeding demo data.",
  )

  await remoteLink.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  })

  logger.info("Seeding fulfillment data...")
  const { result: shippingProfileResult } = await createShippingProfilesWorkflow(container).run({
    input: {
      data: [
        {
          name: "Default",
          type: "default",
        },
      ],
    },
  })
  const shippingProfile = requireFirst(
    shippingProfileResult,
    "Expected a shipping profile to be created while seeding demo data.",
  )

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Port Harcourt Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Worldwide",
        geo_zones: countries.map((country_code) => ({
          country_code,
          type: "country" as const,
        })),
      },
    ],
  })
  const fulfillmentServiceZone = requireFirst(
    fulfillmentSet.service_zones,
    "Expected a shipping fulfillment service zone to be created.",
  )

  await remoteLink.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentServiceZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            currency_code: "ngn",
            amount: 10 * NGN_PER_USD,
          },
          {
            region_id: nigeriaRegion.id,
            amount: 10 * NGN_PER_USD,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentServiceZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            currency_code: "ngn",
            amount: 10 * NGN_PER_USD,
          },
          {
            region_id: nigeriaRegion.id,
            amount: 10 * NGN_PER_USD,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })

  const pickupFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Store pickup",
    type: "pickup",
    service_zones: [
      {
        name: "Store pickup",
        geo_zones: [
          {
            country_code: "ng",
            type: "country",
          },
        ],
      },
    ],
  })
  const pickupServiceZone = requireFirst(
    pickupFulfillmentSet.service_zones,
    "Expected a pickup fulfillment service zone to be created.",
  )

  await remoteLink.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: pickupFulfillmentSet.id,
    },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Nigeria Store Pickup",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: pickupServiceZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Nigeria Store Pickup",
          description: "Free in-store pickup.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 0,
          },
          {
            currency_code: "eur",
            amount: 0,
          },
          {
            currency_code: "ngn",
            amount: 0,
          },
          {
            region_id: nigeriaRegion.id,
            amount: 0,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })

  logger.info("Finished seeding fulfillment data.")

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannelId],
    },
  })
  logger.info("Finished seeding stock location data.")

  logger.info("Seeding publishable API key data...")
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  })
  const publishableApiKey = requireFirst(
    publishableApiKeyResult,
    "Expected a publishable API key to be created while seeding demo data.",
  )

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannelId],
    },
  })
  logger.info("Finished seeding publishable API key data.")

  logger.info("Seeding product data...")

  const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        {
          name: "Bundles",
          is_active: true,
        },
        {
          name: "Closures & Frontals",
          is_active: true,
        },
        {
          name: "Wigs",
          is_active: true,
        },
      ],
    },
  })
  const bundlesCategoryId = requireFound(
    categoryResult,
    (category) => category.name === "Bundles",
    'Expected "Bundles" product category to exist.',
  ).id
  const closuresFrontalsCategoryId = requireFound(
    categoryResult,
    (category) => category.name === "Closures & Frontals",
    'Expected "Closures & Frontals" product category to exist.',
  ).id
  const wigsCategoryId = requireFound(
    categoryResult,
    (category) => category.name === "Wigs",
    'Expected "Wigs" product category to exist.',
  ).id

  const [extensionsImage, wigsImage] = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "extensions.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/product-types/sofas/image.png",
            ),
          },
          {
            access: "public",
            filename: "wigs.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/product-types/arm-chairs/image.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  const { result: productTypes } = await createProductTypesWorkflow(container).run({
    input: {
      product_types: [
        {
          value: "Extensions",
          metadata: {
            image: extensionsImage,
          },
        },
        {
          value: "Wigs & Units",
          metadata: {
            image: wigsImage,
          },
        },
      ],
    },
  })
  const extensionsProductTypeId = requireFound(
    productTypes,
    (productType) => productType.value === "Extensions",
    'Expected "Extensions" product type to exist.',
  ).id
  const wigsProductTypeId = requireFound(
    productTypes,
    (productType) => productType.value === "Wigs & Units",
    'Expected "Wigs & Units" product type to exist.',
  ).id

  const [
    brazilianVirginImage,
    brazilianVirginCollectionPageImage,
    brazilianVirginProductPageImage,
    brazilianVirginProductPageWideImage,
    brazilianVirginProductPageCtaImage,
    peruvianSilkyImage,
    peruvianSilkyCollectionPageImage,
    peruvianSilkyProductPageImage,
    peruvianSilkyProductPageWideImage,
    peruvianSilkyProductPageCtaImage,
    indianRawImage,
    indianRawCollectionPageImage,
    indianRawProductPageImage,
    indianRawProductPageWideImage,
    indianRawProductPageCtaImage,
    cambodianDonorImage,
    cambodianDonorCollectionPageImage,
    cambodianDonorProductPageImage,
    cambodianDonorProductPageWideImage,
    cambodianDonorProductPageCtaImage,
  ] = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "brazilian-virgin.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/scandinavian-simplicity/image.png",
            ),
          },
          {
            access: "public",
            filename: "scandinavian-simplicity-collection-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/scandinavian-simplicity/collection_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "scandinavian-simplicity-product-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/scandinavian-simplicity/product_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "scandinavian-simplicity-product-page-wide-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/scandinavian-simplicity/product_page_wide_image.png",
            ),
          },
          {
            access: "public",
            filename: "scandinavian-simplicity-product-page-cta-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/scandinavian-simplicity/product_page_cta_image.png",
            ),
          },
          {
            access: "public",
            filename: "modern-luxe.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/modern-luxe/image.png",
            ),
          },
          {
            access: "public",
            filename: "modern-luxe-collection-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/modern-luxe/collection_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "modern-luxe-product-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/modern-luxe/product_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "modern-luxe-product-page-wide-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/modern-luxe/product_page_wide_image.png",
            ),
          },
          {
            access: "public",
            filename: "modern-luxe-product-page-cta-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/modern-luxe/product_page_cta_image.png",
            ),
          },
          {
            access: "public",
            filename: "boho-chic.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/boho-chic/image.png",
            ),
          },
          {
            access: "public",
            filename: "boho-chic-collection-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/boho-chic/collection_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "boho-chic-product-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/boho-chic/product_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "boho-chic-product-page-wide-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/boho-chic/product_page_wide_image.png",
            ),
          },
          {
            access: "public",
            filename: "boho-chic-product-page-cta-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/boho-chic/product_page_cta_image.png",
            ),
          },
          {
            access: "public",
            filename: "timeless-classics.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/timeless-classics/image.png",
            ),
          },
          {
            access: "public",
            filename: "timeless-classics-collection-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/timeless-classics/collection_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "timeless-classics-product-page-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/timeless-classics/product_page_image.png",
            ),
          },
          {
            access: "public",
            filename: "timeless-classics-product-page-wide-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/timeless-classics/product_page_wide_image.png",
            ),
          },
          {
            access: "public",
            filename: "timeless-classics-product-page-cta-image.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/collections/timeless-classics/product_page_cta_image.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  const { result: collections } = await createCollectionsWorkflow(container).run({
    input: {
      collections: [
        {
          title: "Brazilian Virgin",
          handle: "brazilian-virgin",
          metadata: {
            description:
              "Silky-smooth Brazilian raw donor hair, unprocessed and full of natural life",
            image: brazilianVirginImage,
            collection_page_image: brazilianVirginCollectionPageImage,
            collection_page_heading: "Brazilian Virgin: Pure raw donor hair with natural movement",
            collection_page_content: `Sourced directly from Brazilian donors and never chemically processed. Soft, silky, and built to last through washing, styling, and daily wear.

This collection brings the finest Brazilian raw hair straight to your door.`,
            product_page_heading: "Collection Inspired Styles",
            product_page_image: brazilianVirginProductPageImage,
            product_page_wide_image: brazilianVirginProductPageWideImage,
            product_page_cta_image: brazilianVirginProductPageCtaImage,
            product_page_cta_heading:
              "The '[product name]' delivers effortless natural movement with pure Brazilian raw texture.",
            product_page_cta_link: "See more from the 'Brazilian Virgin' collection",
          },
        },
        {
          title: "Peruvian Silky",
          handle: "peruvian-silky",
          metadata: {
            description:
              "Lightweight and naturally lustrous Peruvian virgin hair with a long-lasting shine",
            image: peruvianSilkyImage,
            collection_page_image: peruvianSilkyCollectionPageImage,
            collection_page_heading: "Peruvian Silky: Naturally straight, naturally stunning",
            collection_page_content: `Lightweight with incredible natural luster, Peruvian virgin hair blends seamlessly with most hair textures. Low-maintenance and long-lasting with minimal shedding.

Elevate your look with hair that moves and shines like your own.`,
            product_page_heading: "Collection Inspired Styles",
            product_page_image: peruvianSilkyProductPageImage,
            product_page_wide_image: peruvianSilkyProductPageWideImage,
            product_page_cta_image: peruvianSilkyProductPageCtaImage,
            product_page_cta_heading:
              "The '[product name]' is a statement piece — pure Peruvian silk with a flawless finish.",
            product_page_cta_link: "See more from the 'Peruvian Silky' collection",
          },
        },
        {
          title: "Indian Raw",
          handle: "indian-raw",
          metadata: {
            description: "Dense and versatile raw Indian donor hair with natural wave patterns",
            image: indianRawImage,
            collection_page_image: indianRawCollectionPageImage,
            collection_page_heading: "Indian Raw: Dense, natural, and incredibly versatile",
            collection_page_content: `Raw Indian donor hair collected directly at the source with cuticles intact and aligned. Known for its density, natural wave, and ability to hold styles beautifully.

The go-to choice for clients who want volume, versatility, and longevity.`,
            product_page_heading: "Collection Inspired Styles",
            product_page_image: indianRawProductPageImage,
            product_page_wide_image: indianRawProductPageWideImage,
            product_page_cta_image: indianRawProductPageCtaImage,
            product_page_cta_heading:
              "The '[product name]' captures the essence of raw Indian hair — dense, natural, and built for everyday wear.",
            product_page_cta_link: "See more from the 'Indian Raw' collection",
          },
        },
        {
          title: "Cambodian Donor",
          handle: "cambodian-donor",
          metadata: {
            description:
              "Thick and durable Cambodian donor hair known for its natural body and strength",
            image: cambodianDonorImage,
            collection_page_image: cambodianDonorCollectionPageImage,
            collection_page_heading: "Cambodian Donor: Thick, strong, and built to last",
            collection_page_content: `Cambodian donor hair is prized for its coarse, thick strands that hold curls and styles with ease. Collected from single donors for maximum consistency.

Perfect for clients who want bold, full-bodied hair that lasts.`,
            product_page_heading: "Collection Inspired Styles",
            product_page_image: cambodianDonorProductPageImage,
            product_page_wide_image: cambodianDonorProductPageWideImage,
            product_page_cta_image: cambodianDonorProductPageCtaImage,
            product_page_cta_heading:
              "The '[product name]' brings full-bodied Cambodian donor texture with strength and natural movement.",
            product_page_cta_link: "See more from the 'Cambodian Donor' collection",
          },
        },
      ],
    },
  })
  const brazilianVirginCollectionId = requireFound(
    collections,
    (collection) => collection.handle === "brazilian-virgin",
    'Expected "brazilian-virgin" collection to exist.',
  ).id
  const peruvianSilkyCollectionId = requireFound(
    collections,
    (collection) => collection.handle === "peruvian-silky",
    'Expected "peruvian-silky" collection to exist.',
  ).id
  const indianRawCollectionId = requireFound(
    collections,
    (collection) => collection.handle === "indian-raw",
    'Expected "indian-raw" collection to exist.',
  ).id
  const cambodianDonorCollectionId = requireFound(
    collections,
    (collection) => collection.handle === "cambodian-donor",
    'Expected "cambodian-donor" collection to exist.',
  ).id

  const materials: MaterialModelType[] = await fashionModuleService.createMaterials([
    {
      name: "Brazilian",
    },
    {
      name: "Peruvian",
    },
    {
      name: "Indian",
    },
    {
      name: "Malaysian",
    },
    {
      name: "Cambodian",
    },
  ])
  const brazilianMaterialId = requireFound(
    materials,
    (material) => material.name === "Brazilian",
    'Expected "Brazilian" material to exist.',
  ).id
  const peruvianMaterialId = requireFound(
    materials,
    (material) => material.name === "Peruvian",
    'Expected "Peruvian" material to exist.',
  ).id
  const indianMaterialId = requireFound(
    materials,
    (material) => material.name === "Indian",
    'Expected "Indian" material to exist.',
  ).id
  const malaysianMaterialId = requireFound(
    materials,
    (material) => material.name === "Malaysian",
    'Expected "Malaysian" material to exist.',
  ).id
  const cambodianMaterialId = requireFound(
    materials,
    (material) => material.name === "Cambodian",
    'Expected "Cambodian" material to exist.',
  ).id

  await fashionModuleService.createColors([
    // Brazilian
    {
      name: "Natural Black",
      hex_code: "#1A1A1A",
      material_id: brazilianMaterialId,
    },
    {
      name: "Dark Brown",
      hex_code: "#3B2314",
      material_id: brazilianMaterialId,
    },
    // Peruvian
    {
      name: "Natural Black",
      hex_code: "#1A1A1A",
      material_id: peruvianMaterialId,
    },
    {
      name: "Dark Brown",
      hex_code: "#3B2314",
      material_id: peruvianMaterialId,
    },
    {
      name: "Medium Brown",
      hex_code: "#6B4423",
      material_id: peruvianMaterialId,
    },
    {
      name: "Burgundy",
      hex_code: "#6B0F1A",
      material_id: peruvianMaterialId,
    },
    {
      name: "Blonde 613",
      hex_code: "#E8C97D",
      material_id: peruvianMaterialId,
    },
    // Indian
    {
      name: "Natural Black",
      hex_code: "#1A1A1A",
      material_id: indianMaterialId,
    },
    {
      name: "Off Black",
      hex_code: "#2A2020",
      material_id: indianMaterialId,
    },
    {
      name: "Dark Brown",
      hex_code: "#3B2314",
      material_id: indianMaterialId,
    },
    // Malaysian
    {
      name: "Natural Black",
      hex_code: "#1A1A1A",
      material_id: malaysianMaterialId,
    },
    {
      name: "Dark Brown",
      hex_code: "#3B2314",
      material_id: malaysianMaterialId,
    },
    // Cambodian
    {
      name: "Natural Black",
      hex_code: "#1A1A1A",
      material_id: cambodianMaterialId,
    },
    {
      name: "Dark Brown",
      hex_code: "#3B2314",
      material_id: cambodianMaterialId,
    },
    {
      name: "Off Black",
      hex_code: "#2A2020",
      material_id: cambodianMaterialId,
    },
  ])

  const indianBodyWaveImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "indian-body-wave-bundle.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/astrid-curve/image.png",
            ),
          },
          {
            access: "public",
            filename: "indian-body-wave-bundle-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/astrid-curve/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Indian Body Wave Bundle",
          handle: "indian-body-wave-bundle",
          description:
            "Raw Indian body wave bundles with a natural, flowing wave pattern. Full from root to tip with minimal shedding. Perfect for achieving voluminous, textured styles that hold beautifully.",
          category_ids: [bundlesCategoryId],
          collection_id: indianRawCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: indianBodyWaveImages,
          options: [
            {
              title: "Origin",
              values: ["Cambodian", "Indian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Cambodian / Natural Black",
              sku: "INDIAN-BODY-WAVE-CAMBODIAN-NATURAL-BLACK",
              options: {
                Origin: "Cambodian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Indian / Dark Brown",
              sku: "INDIAN-BODY-WAVE-INDIAN-DARK-BROWN",
              options: {
                Origin: "Indian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const cambodianClosureImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "cambodian-straight-closure.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/belime-estate/image.png",
            ),
          },
          {
            access: "public",
            filename: "cambodian-straight-closure-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/belime-estate/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Cambodian 4x4 Straight Closure",
          handle: "cambodian-4x4-straight-closure",
          description:
            "A 4x4 lace closure made from raw Cambodian straight donor hair. Naturally thick and aligned from root to tip. Provides a natural-looking hairline with minimal maintenance and long-lasting durability.",
          category_ids: [closuresFrontalsCategoryId],
          collection_id: cambodianDonorCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: cambodianClosureImages,
          options: [
            {
              title: "Origin",
              values: ["Peruvian", "Cambodian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Burgundy"],
            },
          ],
          variants: [
            {
              title: "Peruvian / Natural Black",
              sku: "CAMBODIAN-4X4-CLOSURE-PERUVIAN-NATURAL-BLACK",
              options: {
                Origin: "Peruvian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Peruvian / Dark Brown",
              sku: "CAMBODIAN-4X4-CLOSURE-PERUVIAN-DARK-BROWN",
              options: {
                Origin: "Peruvian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Dark Brown",
              sku: "CAMBODIAN-4X4-CLOSURE-CAMBODIAN-DARK-BROWN",
              options: {
                Origin: "Cambodian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const cambodianDeepWaveImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "cambodian-deep-wave-bundle.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/cypress-retreat/image.png",
            ),
          },
          {
            access: "public",
            filename: "cambodian-deep-wave-bundle-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/cypress-retreat/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Cambodian Deep Wave Bundle",
          handle: "cambodian-deep-wave-bundle",
          description:
            "Raw Cambodian deep wave bundles with a defined, tight wave pattern. Known for their thickness and strength, these bundles hold curl effortlessly and maintain their pattern even after washing.",
          category_ids: [bundlesCategoryId],
          collection_id: cambodianDonorCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: cambodianDeepWaveImages,
          options: [
            {
              title: "Origin",
              values: ["Malaysian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Malaysian / Natural Black",
              sku: "CAMBODIAN-DEEP-WAVE-MALAYSIAN-NATURAL-BLACK",
              options: {
                Origin: "Malaysian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Malaysian / Dark Brown",
              sku: "CAMBODIAN-DEEP-WAVE-MALAYSIAN-DARK-BROWN",
              options: {
                Origin: "Malaysian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const peruvianFrontalImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "peruvian-loose-wave-frontal.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/everly-estate/image.png",
            ),
          },
          {
            access: "public",
            filename: "peruvian-loose-wave-frontal-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/everly-estate/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Peruvian 13x4 Loose Wave Frontal",
          handle: "peruvian-13x4-loose-wave-frontal",
          description:
            "A 13x4 lace frontal made from raw Peruvian loose wave hair. Lightweight with a natural wave that flows effortlessly. Ideal for a seamless hairline and versatile parting. Low shedding, long lasting.",
          category_ids: [closuresFrontalsCategoryId],
          collection_id: peruvianSilkyCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: peruvianFrontalImages,
          options: [
            {
              title: "Origin",
              values: ["Cambodian", "Indian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Cambodian / Natural Black",
              sku: "PERUVIAN-13X4-FRONTAL-CAMBODIAN-NATURAL-BLACK",
              options: {
                Origin: "Cambodian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Indian / Dark Brown",
              sku: "PERUVIAN-13X4-FRONTAL-INDIAN-DARK-BROWN",
              options: {
                Origin: "Indian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const cambodianWigImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "cambodian-body-wave-wig.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/havenhill-estate/image.png",
            ),
          },
          {
            access: "public",
            filename: "cambodian-body-wave-wig-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/havenhill-estate/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Cambodian Body Wave Wig",
          handle: "cambodian-body-wave-wig",
          description:
            "A full lace wig made from raw Cambodian body wave donor hair. Natural-looking with a realistic hairline and full density from root to tip. Easy to wear and style — ideal for everyday use or special occasions.",
          category_ids: [wigsCategoryId],
          collection_id: cambodianDonorCollectionId,
          type_id: wigsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: cambodianWigImages,
          options: [
            {
              title: "Origin",
              values: ["Peruvian", "Cambodian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Medium Brown"],
            },
          ],
          variants: [
            {
              title: "Peruvian / Natural Black",
              sku: "CAMBODIAN-BODY-WAVE-WIG-PERUVIAN-NATURAL-BLACK",
              options: {
                Origin: "Peruvian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1000,
                  currency_code: "eur",
                },
                {
                  amount: 1200,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Dark Brown",
              sku: "CAMBODIAN-BODY-WAVE-WIG-CAMBODIAN-DARK-BROWN",
              options: {
                Origin: "Cambodian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1200,
                  currency_code: "eur",
                },
                {
                  amount: 1400,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const peruvianStraightBundleImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "peruvian-straight-bundle.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/monaco-flair/image.png",
            ),
          },
          {
            access: "public",
            filename: "peruvian-straight-bundle-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/monaco-flair/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Peruvian Straight Bundle",
          handle: "peruvian-straight-bundle",
          description:
            "Raw Peruvian straight bundles — silky, smooth, and naturally lustrous. Lightweight with zero chemical processing. Blends effortlessly with most hair types and holds up beautifully through heat styling and washing.",
          category_ids: [bundlesCategoryId],
          collection_id: peruvianSilkyCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: peruvianStraightBundleImages,
          options: [
            {
              title: "Origin",
              values: ["Peruvian", "Cambodian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Blonde 613"],
            },
          ],
          variants: [
            {
              title: "Peruvian / Natural Black",
              sku: "PERUVIAN-STRAIGHT-BUNDLE-PERUVIAN-NATURAL-BLACK",
              options: {
                Origin: "Peruvian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Dark Brown",
              sku: "PERUVIAN-STRAIGHT-BUNDLE-CAMBODIAN-DARK-BROWN",
              options: {
                Origin: "Cambodian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Blonde 613",
              sku: "PERUVIAN-STRAIGHT-BUNDLE-CAMBODIAN-BLONDE-613",
              options: {
                Origin: "Cambodian",
                Color: "Blonde 613",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const brazilianLooseWaveWigImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "brazilian-loose-wave-wig.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/nordic-breeze/image.png",
            ),
          },
          {
            access: "public",
            filename: "brazilian-loose-wave-wig-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/nordic-breeze/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Brazilian Loose Wave Wig",
          handle: "brazilian-loose-wave-wig",
          description:
            "A lace front wig crafted from raw Brazilian loose wave donor hair. Soft, natural wave pattern with full body and shine. Comfortable fit with a natural-looking hairline and versatile parting options.",
          category_ids: [wigsCategoryId],
          collection_id: brazilianVirginCollectionId,
          type_id: wigsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: brazilianLooseWaveWigImages,
          options: [
            {
              title: "Origin",
              values: ["Cambodian", "Brazilian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Off Black"],
            },
          ],
          variants: [
            {
              title: "Cambodian / Natural Black",
              sku: "BRAZILIAN-LOOSE-WAVE-WIG-CAMBODIAN-NATURAL-BLACK",
              options: {
                Origin: "Cambodian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1200,
                  currency_code: "eur",
                },
                {
                  amount: 1400,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Dark Brown",
              sku: "BRAZILIAN-LOOSE-WAVE-WIG-BRAZILIAN-DARK-BROWN",
              options: {
                Origin: "Brazilian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1200,
                  currency_code: "eur",
                },
                {
                  amount: 1400,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Off Black",
              sku: "BRAZILIAN-LOOSE-WAVE-WIG-BRAZILIAN-OFF-BLACK",
              options: {
                Origin: "Brazilian",
                Color: "Off Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1800,
                  currency_code: "eur",
                },
                {
                  amount: 2000,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const brazilianBodyWaveImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "brazilian-body-wave-bundle.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/nordic-haven/image.png",
            ),
          },
          {
            access: "public",
            filename: "brazilian-body-wave-bundle-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/nordic-haven/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Brazilian Body Wave Bundle",
          handle: "brazilian-body-wave-bundle",
          description:
            "Pure raw Brazilian body wave bundles — soft, flowing wave pattern with incredible natural movement. Unprocessed donor hair that holds its wave after washing and styling. A bestseller for its blend of versatility and longevity.",
          category_ids: [bundlesCategoryId],
          collection_id: brazilianVirginCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: brazilianBodyWaveImages,
          options: [
            {
              title: "Origin",
              values: ["Peruvian", "Brazilian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Medium Brown"],
            },
          ],
          variants: [
            {
              title: "Peruvian / Natural Black",
              sku: "BRAZILIAN-BODY-WAVE-PERUVIAN-NATURAL-BLACK",
              options: {
                Origin: "Peruvian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Dark Brown",
              sku: "BRAZILIAN-BODY-WAVE-BRAZILIAN-DARK-BROWN",
              options: {
                Origin: "Brazilian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Medium Brown",
              sku: "BRAZILIAN-BODY-WAVE-BRAZILIAN-MEDIUM-BROWN",
              options: {
                Origin: "Brazilian",
                Color: "Medium Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const brazilianClosureImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "brazilian-4x4-body-wave-closure.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/oslo-drift/image.png",
            ),
          },
          {
            access: "public",
            filename: "brazilian-4x4-body-wave-closure-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/oslo-drift/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Brazilian 4x4 Body Wave Closure",
          handle: "brazilian-4x4-body-wave-closure",
          description:
            "A 4x4 HD lace closure made from raw Brazilian body wave hair. Thin, transparent lace that melts into the scalp for an undetectable finish. Pairs perfectly with Brazilian body wave bundles for a complete install.",
          category_ids: [closuresFrontalsCategoryId],
          collection_id: brazilianVirginCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: brazilianClosureImages,
          options: [
            {
              title: "Origin",
              values: ["Cambodian", "Brazilian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Off Black"],
            },
          ],
          variants: [
            {
              title: "Cambodian / Natural Black",
              sku: "BRAZILIAN-4X4-CLOSURE-CAMBODIAN-NATURAL-BLACK",
              options: {
                Origin: "Cambodian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Dark Brown",
              sku: "BRAZILIAN-4X4-CLOSURE-BRAZILIAN-DARK-BROWN",
              options: {
                Origin: "Brazilian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Off Black",
              sku: "BRAZILIAN-4X4-CLOSURE-BRAZILIAN-OFF-BLACK",
              options: {
                Origin: "Brazilian",
                Color: "Off Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const brazilianFrontalImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "brazilian-13x4-lace-frontal.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/oslo-serenity/image.png",
            ),
          },
          {
            access: "public",
            filename: "brazilian-13x4-lace-frontal-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/oslo-serenity/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Brazilian 13x4 Lace Frontal",
          handle: "brazilian-13x4-lace-frontal",
          description:
            "A 13x4 lace frontal made from raw Brazilian straight donor hair. Full ear-to-ear coverage with a natural hairline. HD lace melts seamlessly for a flawless, undetectable finish. Perfect for any protective style.",
          category_ids: [closuresFrontalsCategoryId],
          collection_id: brazilianVirginCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: brazilianFrontalImages,
          options: [
            {
              title: "Origin",
              values: ["Malaysian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Malaysian / Natural Black",
              sku: "BRAZILIAN-13X4-FRONTAL-MALAYSIAN-NATURAL-BLACK",
              options: {
                Origin: "Malaysian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Malaysian / Dark Brown",
              sku: "BRAZILIAN-13X4-FRONTAL-MALAYSIAN-DARK-BROWN",
              options: {
                Origin: "Malaysian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const peruvianStraightWigImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "peruvian-straight-wig.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/paloma-haven/image.png",
            ),
          },
          {
            access: "public",
            filename: "peruvian-straight-wig-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/paloma-haven/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Peruvian Straight Wig",
          handle: "peruvian-straight-wig",
          description:
            "A sleek lace front wig made from raw Peruvian straight donor hair. Silky and lightweight with a smooth finish and natural shine. Low maintenance and easy to style — lay it flat or add curls, it delivers every time.",
          category_ids: [wigsCategoryId],
          collection_id: peruvianSilkyCollectionId,
          type_id: wigsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: peruvianStraightWigImages,
          options: [
            {
              title: "Origin",
              values: ["Peruvian", "Cambodian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown", "Medium Brown"],
            },
          ],
          variants: [
            {
              title: "Peruvian / Natural Black",
              sku: "PERUVIAN-STRAIGHT-WIG-PERUVIAN-NATURAL-BLACK",
              options: {
                Origin: "Peruvian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 900,
                  currency_code: "eur",
                },
                {
                  amount: 1100,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Peruvian / Dark Brown",
              sku: "PERUVIAN-STRAIGHT-WIG-PERUVIAN-DARK-BROWN",
              options: {
                Origin: "Peruvian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 900,
                  currency_code: "eur",
                },
                {
                  amount: 1100,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Medium Brown",
              sku: "PERUVIAN-STRAIGHT-WIG-CAMBODIAN-MEDIUM-BROWN",
              options: {
                Origin: "Cambodian",
                Color: "Medium Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1200,
                  currency_code: "eur",
                },
                {
                  amount: 1400,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const indianDeepWaveWigImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "indian-deep-wave-wig.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/savannah-grove/image.png",
            ),
          },
          {
            access: "public",
            filename: "indian-deep-wave-wig-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/savannah-grove/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Indian Deep Wave Wig",
          handle: "indian-deep-wave-wig",
          description:
            "A glueless lace wig made from raw Indian deep wave donor hair. Full, bouncy, and defined waves with incredible density. The deep wave pattern holds beautifully and springs back after washing — no frizz, no flat.",
          category_ids: [wigsCategoryId],
          collection_id: indianRawCollectionId,
          type_id: wigsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: indianDeepWaveWigImages,
          options: [
            {
              title: "Origin",
              values: ["Indian", "Brazilian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Off Black"],
            },
          ],
          variants: [
            {
              title: "Indian / Natural Black",
              sku: "INDIAN-DEEP-WAVE-WIG-INDIAN-NATURAL-BLACK",
              options: {
                Origin: "Indian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1200,
                  currency_code: "eur",
                },
                {
                  amount: 1400,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Off Black",
              sku: "INDIAN-DEEP-WAVE-WIG-BRAZILIAN-OFF-BLACK",
              options: {
                Origin: "Brazilian",
                Color: "Off Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 900,
                  currency_code: "eur",
                },
                {
                  amount: 1100,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Brazilian / Natural Black",
              sku: "INDIAN-DEEP-WAVE-WIG-BRAZILIAN-NATURAL-BLACK",
              options: {
                Origin: "Brazilian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 900,
                  currency_code: "eur",
                },
                {
                  amount: 1100,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const cambodianWaterWaveImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "cambodian-water-wave-closure.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/serena-meadow/image.png",
            ),
          },
          {
            access: "public",
            filename: "cambodian-water-wave-closure-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/serena-meadow/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Cambodian Water Wave Closure",
          handle: "cambodian-water-wave-closure",
          description:
            "A 5x5 HD lace closure made from raw Cambodian water wave donor hair. Loose, natural wave pattern with a wet-and-wavy finish. Thick and durable with a natural-looking part and seamless blending.",
          category_ids: [closuresFrontalsCategoryId],
          collection_id: cambodianDonorCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: cambodianWaterWaveImages,
          options: [
            {
              title: "Origin",
              values: ["Cambodian", "Indian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Cambodian / Natural Black",
              sku: "CAMBODIAN-WATER-WAVE-CLOSURE-CAMBODIAN-NATURAL-BLACK",
              options: {
                Origin: "Cambodian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Dark Brown",
              sku: "CAMBODIAN-WATER-WAVE-CLOSURE-CAMBODIAN-DARK-BROWN",
              options: {
                Origin: "Cambodian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Indian / Natural Black",
              sku: "CAMBODIAN-WATER-WAVE-CLOSURE-INDIAN-NATURAL-BLACK",
              options: {
                Origin: "Indian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const indianFrontalImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "indian-kinky-curly-frontal.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/sutton-royale/image.png",
            ),
          },
          {
            access: "public",
            filename: "indian-kinky-curly-frontal-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/sutton-royale/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Indian Kinky Curly Frontal",
          handle: "indian-kinky-curly-frontal",
          description:
            "A 13x4 lace frontal made from raw Indian kinky curly donor hair. Tight, defined curls with maximum volume and density. Undetectable hairline, full ear-to-ear coverage, and a curl pattern that thrives with moisture.",
          category_ids: [closuresFrontalsCategoryId],
          collection_id: indianRawCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: indianFrontalImages,
          options: [
            {
              title: "Origin",
              values: ["Indian", "Cambodian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Off Black"],
            },
          ],
          variants: [
            {
              title: "Indian / Natural Black",
              sku: "INDIAN-KINKY-CURLY-FRONTAL-INDIAN-NATURAL-BLACK",
              options: {
                Origin: "Indian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Off Black",
              sku: "INDIAN-KINKY-CURLY-FRONTAL-CAMBODIAN-OFF-BLACK",
              options: {
                Origin: "Cambodian",
                Color: "Off Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const peruvianBodyWaveWigImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "peruvian-body-wave-wig.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/velar-loft/image.png",
            ),
          },
          {
            access: "public",
            filename: "peruvian-body-wave-wig-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/velar-loft/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Peruvian Body Wave Wig",
          handle: "peruvian-body-wave-wig",
          description:
            "A lace front wig made from raw Peruvian body wave donor hair. Lightweight, natural-looking waves with a silky finish. Easy to style from straight to wavy and back. A go-to unit for everyday luxury.",
          category_ids: [wigsCategoryId],
          collection_id: peruvianSilkyCollectionId,
          type_id: wigsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: peruvianBodyWaveWigImages,
          options: [
            {
              title: "Origin",
              values: ["Indian", "Cambodian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Indian / Natural Black",
              sku: "PERUVIAN-BODY-WAVE-WIG-INDIAN-NATURAL-BLACK",
              options: {
                Origin: "Indian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1300,
                  currency_code: "eur",
                },
                {
                  amount: 1500,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Cambodian / Dark Brown",
              sku: "PERUVIAN-BODY-WAVE-WIG-CAMBODIAN-DARK-BROWN",
              options: {
                Origin: "Cambodian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1100,
                  currency_code: "eur",
                },
                {
                  amount: 1300,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  const indianLooseWaveImages = await uploadFilesWorkflow(container)
    .run({
      input: {
        files: [
          {
            access: "public",
            filename: "indian-loose-wave-bundle.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/velora-luxe/image.png",
            ),
          },
          {
            access: "public",
            filename: "indian-loose-wave-bundle-2.png",
            mimeType: "image/png",
            content: await getImageUrlContent(
              "https://assets.agilo.com/fashion-starter/products/velora-luxe/image1.png",
            ),
          },
        ],
      },
    })
    .then((res) => res.result)

  await createProductsWorkflow(container).run({
    input: withNgnVariantPrices({
      products: [
        {
          title: "Indian Loose Wave Bundle",
          handle: "indian-loose-wave-bundle",
          description:
            "Raw Indian loose wave bundles with a relaxed, natural wave pattern and incredible softness. Full density from roots to ends, minimal shedding, and a texture that responds beautifully to moisture and styling.",
          category_ids: [bundlesCategoryId],
          collection_id: indianRawCollectionId,
          type_id: extensionsProductTypeId,
          status: ProductStatus.PUBLISHED,
          images: indianLooseWaveImages,
          options: [
            {
              title: "Origin",
              values: ["Peruvian", "Indian"],
            },
            {
              title: "Color",
              values: ["Natural Black", "Dark Brown"],
            },
          ],
          variants: [
            {
              title: "Peruvian / Natural Black",
              sku: "INDIAN-LOOSE-WAVE-BUNDLE-PERUVIAN-NATURAL-BLACK",
              options: {
                Origin: "Peruvian",
                Color: "Natural Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1500,
                  currency_code: "eur",
                },
                {
                  amount: 1700,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Indian / Dark Brown",
              sku: "INDIAN-LOOSE-WAVE-BUNDLE-INDIAN-DARK-BROWN",
              options: {
                Origin: "Indian",
                Color: "Dark Brown",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 2000,
                  currency_code: "eur",
                },
                {
                  amount: 2200,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannelId,
            },
          ],
        },
      ],
    }),
  })

  logger.info("Finished seeding product data.")
}
