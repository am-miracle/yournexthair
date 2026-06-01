import type { SearchTypes } from "@medusajs/types"
import { SearchUtils } from "@medusajs/utils"
// @ts-expect-error meilisearch is ESM-only; type-only import is erased at compile time
import { Meilisearch, MeilisearchApiError } from "meilisearch"
import type { MeilisearchPluginOptions } from "./types"
import { logger } from "@medusajs/framework"

type MeilisearchIndex = ReturnType<InstanceType<typeof Meilisearch>["index"]>
type AddDocumentsArg = Parameters<MeilisearchIndex["addDocuments"]>[0][number]
type UpdateSettingsArg = Parameters<MeilisearchIndex["updateSettings"]>[0]
type SearchOptions = NonNullable<Parameters<MeilisearchIndex["search"]>[1]>
type DocTransformer = (doc: Record<string, unknown>) => AddDocumentsArg

export class MeilisearchService extends SearchUtils.AbstractSearchService {
  static identifier = "meilisearch"

  isDefault = false

  private readonly typedOptions: MeilisearchPluginOptions
  protected readonly client: Meilisearch

  constructor(container: unknown, options: MeilisearchPluginOptions) {
    super(container, options)
    this.typedOptions = options

    if (process.env.NODE_ENV !== "development") {
      if (!options.config?.apiKey) {
        throw new Error("Meilisearch API key is required for production environments.")
      }
    }

    if (!options.config?.host) {
      throw new Error("Meilisearch host is required. Please provide a host in the configuration.")
    }

    this.client = new Meilisearch(options.config)
  }

  createIndex(indexName: string, options: Record<string, unknown> = { primaryKey: "id" }) {
    return this.client.createIndex(indexName, options)
  }

  getIndex(indexName: string) {
    return this.client.index(indexName)
  }

  addDocuments(indexName: string, documents: Record<string, unknown>[], _type: string) {
    const indexSetting = this.typedOptions.settings?.[indexName]
    const transformer: DocTransformer =
      (indexSetting?.transformer as DocTransformer | undefined) ?? ((doc) => doc)
    const primaryKey = indexSetting?.primaryKey ?? "id"

    return this.client.index(indexName).addDocuments(documents.map(transformer), { primaryKey })
  }

  replaceDocuments(indexName: string, documents: Record<string, unknown>[], type: string) {
    return this.addDocuments(indexName, documents, type)
  }

  deleteDocument(indexName: string, documentId: string) {
    return this.client.index(indexName).deleteDocument(documentId)
  }

  deleteAllDocuments(indexName: string) {
    return this.client.index(indexName).deleteAllDocuments()
  }

  search(indexName: string, query: string, options: Record<string, unknown>) {
    const { paginationOptions, filter, additionalOptions } = options

    return this.client.index(indexName).search(query, {
      filter,
      ...(paginationOptions as Record<string, unknown>),
      ...(additionalOptions as Record<string, unknown>),
    } as unknown as SearchOptions)
  }

  async updateSettings(
    indexName: string,
    settings: SearchTypes.IndexSettings & { indexSettings?: UpdateSettingsArg },
  ) {
    const indexSettings = (settings.indexSettings ?? {}) as UpdateSettingsArg

    try {
      await this.client.getIndex(indexName)
    } catch (error) {
      if (error instanceof MeilisearchApiError && error.cause?.code === "index_not_found") {
        await this.createIndex(indexName, {
          primaryKey: settings.primaryKey ?? "id",
        })
      } else {
        logger.error(error instanceof Error ? error : String(error))
        throw error
      }
    }

    return this.client.index(indexName).updateSettings(indexSettings)
  }
}
