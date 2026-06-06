import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import type { ProductDTO } from "@medusajs/types"

import type { MeilisearchPluginOptions } from "./src/modules/meilisearch/types"

loadEnv(process.env.NODE_ENV ?? "development", process.cwd())

const requireSecret = (name: string): string => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const meiliSearchOptions: MeilisearchPluginOptions = {
  config: {
    host: process.env.MEILISEARCH_HOST ?? "https://fashion-starter-search.agilo.agency",
    ...(process.env.MEILISEARCH_API_KEY
      ? { apiKey: process.env.MEILISEARCH_API_KEY }
      : {}),
  },
  settings: {
    products: {
      indexSettings: {
        searchableAttributes: [
          "title",
          "subtitle",
          "description",
          "collection",
          "categories",
          "type",
          "tags",
          "variants",
          "sku",
        ],
        displayedAttributes: [
          "id",
          "title",
          "handle",
          "subtitle",
          "description",
          "is_giftcard",
          "status",
          "thumbnail",
          "collection",
          "collection_handle",
          "categories",
          "categories_handle",
          "type",
          "tags",
          "variants",
          "sku",
        ],
      },
      primaryKey: "id",
      transformer: (product: ProductDTO) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        subtitle: product.subtitle,
        description: product.description,
        is_giftcard: product.is_giftcard,
        status: product.status,
        thumbnail: product.images?.[0]?.url ?? null,
        collection: product?.collection?.title,
        collection_handle: product?.collection?.handle,
        categories: product.categories?.map((category) => category.name) ?? [],
        categories_handle: product.categories?.map((category) => category.handle) ?? [],
        type: product.type?.value,
        tags: product.tags.map((tag) => tag.value),
        variants: product.variants.map((variant) => variant.title),
        sku: product.variants
          .filter((variant) => typeof variant.sku === "string" && variant.sku)
          .map((variant) => variant.sku),
      }),
    },
  },
}

module.exports = defineConfig({
  admin: {
    backendUrl: process.env.BACKEND_URL ?? "https://sofa-society-starter.medusajs.app",
    ...(process.env.STOREFRONT_URL ? { storefrontUrl: process.env.STOREFRONT_URL } : {}),
    maxUploadFileSize: 10 * 1024 * 1024, // 10MB
  },
  projectConfig: {
    ...(process.env.DATABASE_URL ? { databaseUrl: process.env.DATABASE_URL } : {}),
    ...(process.env.REDIS_URL ? { redisUrl: process.env.REDIS_URL } : {}),
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:8000",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:5173,http://localhost:9000",
      authCors: process.env.AUTH_CORS ?? "http://localhost:8000,http://localhost:5173,http://localhost:9000",
      jwtSecret: requireSecret("JWT_SECRET"),
      cookieSecret: requireSecret("COOKIE_SECRET"),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          // Primary — handles all currencies (NGN, USD, EUR)
          ...(process.env.FLW_SECRET_KEY
            ? [
                {
                  id: "flutterwave",
                  resolve: "./src/modules/payment",
                  options: {
                    secret_key: process.env.FLW_SECRET_KEY,
                    public_key: process.env.FLW_PUBLIC_KEY,
                    webhook_secret: process.env.FLW_WEBHOOK_SECRET,
                  },
                },
              ]
            : []),
          // Secondary — NGN only, preferred by domestic Nigerian buyers
          ...(process.env.PAYSTACK_SECRET_KEY
            ? [
                {
                  id: "paystack",
                  resolve: "medusa-payment-paystack",
                  options: {
                    secret_key: process.env.PAYSTACK_SECRET_KEY,
                    webhook_secret: process.env.PAYSTACK_WEBHOOK_SECRET,
                  },
                },
              ]
            : []),
        ],
      },
    },
    {
      resolve: "./src/modules/fashion",
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
              additional_client_config: {
                forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" ? true : undefined,
              },
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM,
              siteTitle: "SofaSocietyCo.",
              companyName: "Sofa Society",
              footerLinks: [
                {
                  url: "https://agilo.com",
                  label: "Agilo",
                },
                {
                  url: "https://www.instagram.com/agiloltd/",
                  label: "Instagram",
                },
                {
                  url: "https://www.linkedin.com/company/agilo/",
                  label: "LinkedIn",
                },
              ],
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      resolve: "@medusajs/medusa/caching",
      options: {
        providers: [
          {
            resolve: "@medusajs/caching-redis",
            id: "caching-redis",
            is_default: true,
            options: {
              redisUrl: process.env.REDIS_URL,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          redisUrl: process.env.REDIS_URL,
        },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: {
              redisUrl: process.env.REDIS_URL,
            },
          },
        ],
      },
    },
    ...(process.env.MEILISEARCH_HOST
      ? [
          {
            resolve: "./src/modules/meilisearch",
            options: meiliSearchOptions,
          },
        ]
      : []),
  ],
})
