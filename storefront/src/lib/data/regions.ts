"use server"
import { cache } from "react"
import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"

export const listRegions = cache(async () => {
  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next: { tags: ["regions"] },
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
})

export const retrieveRegion = async function (id: string) {
  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next: { tags: [`regions`] },
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

const getRegionData = cache(async () => {
  const regions = await listRegions()

  if (!regions) {
    return {
      canonicalCountryCodes: [] as string[],
      regionMap: new Map<string, HttpTypes.StoreRegion>(),
    }
  }

  const regionMap = new Map<string, HttpTypes.StoreRegion>()
  const canonicalCountryCodes: string[] = []

  regions.forEach((region) => {
    const countryCodes = (region.countries ?? [])
      .map((country) => country?.iso_2)
      .filter((value): value is string => typeof value === "string" && Boolean(value))

    countryCodes.forEach((countryCode) => {
      regionMap.set(countryCode, region)
    })

    const canonicalCountryCode = countryCodes[0]

    if (canonicalCountryCode) {
      canonicalCountryCodes.push(canonicalCountryCode)
    }
  })

  return {
    canonicalCountryCodes,
    regionMap,
  }
})

export const listStaticCountryCodes = cache(async () => {
  const { canonicalCountryCodes } = await getRegionData()

  return canonicalCountryCodes
})

export const getRegion = async function (countryCode: string) {
  try {
    const { regionMap } = await getRegionData()

    const region = countryCode ? regionMap.get(countryCode) : regionMap.get("ng")

    return region
  } catch (e) {
    return null
  }
}
