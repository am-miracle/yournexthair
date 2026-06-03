import { getBaseURL } from "@lib/util/env"

export const SITE_NAME = "YourNextHair"
export const SITE_DESCRIPTION =
  "Raw and virgin donor hair extensions and wigs shipped nationwide and worldwide."
export const PRIMARY_COUNTRY_CODE = "ng"

export const getCanonicalPath = (path: string = "/") => {
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`

  return `/${PRIMARY_COUNTRY_CODE}${normalizedPath}`
}

export const getCanonicalUrl = (path: string = "/") =>
  new URL(getCanonicalPath(path), getBaseURL()).toString()
