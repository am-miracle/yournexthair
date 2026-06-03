import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function cleanupOrphanedImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fileModuleService = container.resolve(Modules.FILE)
  const productModuleService = container.resolve(Modules.PRODUCT)

  logger.info("Fetching all uploaded files...")
  const [allFiles] = await fileModuleService.listAndCountFiles()

  if (!allFiles.length) {
    logger.info("No files found. Nothing to clean up.")
    return
  }

  logger.info(`Found ${allFiles.length} total files.`)

  logger.info("Fetching all product images...")
  const products = await productModuleService.listProducts(
    {},
    { relations: ["images"] }
  )

  const referencedUrls = new Set(
    products.flatMap((p) => p.images?.map((img) => img.url) ?? [])
  )

  logger.info(`Found ${referencedUrls.size} images referenced by products.`)

  const orphanedFiles = allFiles.filter((file) => !referencedUrls.has(file.url))

  if (!orphanedFiles.length) {
    logger.info("No orphaned files found. Storage is clean.")
    return
  }

  logger.info(`Found ${orphanedFiles.length} orphaned files. Deleting...`)

  const orphanedIds = orphanedFiles.map((f) => f.id)
  await fileModuleService.deleteFiles(orphanedIds)

  logger.info(`Deleted ${orphanedIds.length} orphaned files from storage.`)
  orphanedFiles.forEach((f) => logger.info(`  Deleted: ${f.url}`))
}
