import type { SearchTypes } from '@medusajs/types'
// @ts-expect-error meilisearch is ESM-only; type-only import is erased at compile time
import type { Meilisearch } from 'meilisearch'

// Extract the settings type the client actually expects, without importing Settings by name
type MeilisearchNativeSettings = Parameters<
  ReturnType<InstanceType<typeof Meilisearch>['index']>['updateSettings']
>[0]

export interface MeilisearchPluginOptions {
  config: {
    host: string
    apiKey?: string
    clientAgents?: string[]
    timeout?: number
  }
  settings?: Record<
    string,
    SearchTypes.IndexSettings & {
      indexSettings?: MeilisearchNativeSettings
    }
  >
}
