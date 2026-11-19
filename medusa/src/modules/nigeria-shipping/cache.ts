import { createHash } from "node:crypto"
import type { ICachingModuleService } from "@medusajs/framework/types"

export const AUTH_TTL_SECONDS = 10 * 60
export const QUOTE_TTL_SECONDS = 10 * 60
export const GEOCODE_TTL_SECONDS = 30 * 24 * 60 * 60

export type CacheStore = {
  get(key: string): Promise<object | null>
  set(key: string, value: object, ttlSeconds: number): Promise<void>
  clear(key: string): Promise<void>
}

export const cacheKey = (scope: string, ...parts: string[]) =>
  `nigeria-shipping:v1:${scope}:${createHash("sha256").update(parts.join("\n")).digest("hex")}`

export function memoryStore(): CacheStore {
  const entries = new Map<string, { expires: number; value: object }>()
  return {
    async get(key) {
      const entry = entries.get(key)
      if (entry && entry.expires > Date.now()) return entry.value
      entries.delete(key)
      return null
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
    },
    async clear(key) {
      entries.delete(key)
    },
  }
}

export function cachingModuleStore(
  resolve: () => ICachingModuleService | undefined,
  fallback: CacheStore = memoryStore(),
): CacheStore {
  return {
    async get(key) {
      const caching = resolve()
      return caching ? ((await caching.get({ key })) as object | null) : fallback.get(key)
    },
    async set(key, value, ttlSeconds) {
      const caching = resolve()
      if (!caching) return fallback.set(key, value, ttlSeconds)
      await caching.set({ key, data: value, ttl: ttlSeconds, options: { autoInvalidate: false } })
    },
    async clear(key) {
      const caching = resolve()
      if (!caching) return fallback.clear(key)
      await caching.clear({ key })
    },
  }
}

export class CarrierCache {
  constructor(
    private readonly store: CacheStore = memoryStore(),
    private readonly onError: (message: string) => void = () => {},
  ) {}

  async remember<T extends object>(key: string, ttlSeconds: number, load: () => Promise<T>) {
    const cached = await this.store.get(key).catch((error) => this.report("read", error))
    if (cached) return cached as T
    const value = await load()
    await this.store.set(key, value, ttlSeconds).catch((error) => this.report("write", error))
    return value
  }

  async forget(key: string) {
    await this.store.clear(key).catch((error) => this.report("clear", error))
  }

  private report(action: string, error: unknown): null {
    this.onError(
      `Carrier cache ${action} failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}
