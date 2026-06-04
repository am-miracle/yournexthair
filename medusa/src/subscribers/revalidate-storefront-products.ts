import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"

const PRODUCT_REVALIDATION_EVENTS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "product-variant.created",
  "product-variant.updated",
  "product-variant.deleted",
] as const

export default async function revalidateStorefrontProductsHandler({
  container,
  event,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const storefrontUrl = process.env.STOREFRONT_URL
  const revalidateSecret = process.env.STOREFRONT_REVALIDATE_SECRET

  if (!storefrontUrl || !revalidateSecret) {
    logger.warn(
      "Skipping storefront product revalidation because STOREFRONT_URL or STOREFRONT_REVALIDATE_SECRET is not configured."
    )
    return
  }

  const response = await fetch(`${storefrontUrl}/api/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${revalidateSecret}`,
    },
    body: JSON.stringify({
      tags: ["products"],
      event: event.name,
    }),
  }).catch((error) => {
    logger.error(
      `Failed to call storefront revalidation endpoint for ${event.name}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
    return null
  })

  if (!response) {
    return
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")

    logger.error(
      `Storefront revalidation failed for ${event.name} with status ${response.status}.${body ? ` Response: ${body}` : ""}`
    )
    return
  }

  logger.info(`Triggered storefront product revalidation after ${event.name}`)
}

export const config: SubscriberConfig = {
  event: [...PRODUCT_REVALIDATION_EVENTS],
}
