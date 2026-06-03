import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

async function deleteOrphanedFiles(container: SubscriberArgs<unknown>["container"]) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fileModuleService = container.resolve(Modules.FILE)
  const productModuleService = container.resolve(Modules.PRODUCT)

  const [allFiles] = await fileModuleService.listAndCountFiles()
  if (!allFiles.length) return

  const products = await productModuleService.listProducts(
    {},
    { relations: ["images"] }
  )

  const referencedUrls = new Set(
    products.flatMap((p) => p.images?.map((img) => img.url) ?? [])
  )

  const orphaned = allFiles.filter((f) => !referencedUrls.has(f.url))
  if (!orphaned.length) return

  await fileModuleService.deleteFiles(orphaned.map((f) => f.id))
  logger.info(`Deleted ${orphaned.length} orphaned image(s) from R2 storage.`)
}

export default async function cleanupProductImagesHandler({
  container,
}: SubscriberArgs<{ id: string }>) {
  await deleteOrphanedFiles(container)
}

export const config: SubscriberConfig = {
  event: ["product.updated", "product.deleted"],
}
