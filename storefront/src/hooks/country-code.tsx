import { useParams, usePathname } from "next/navigation"

export const useCountryCode = (
  countryOptions?: {
    country: string
    region: string
    label: string
  }[]
): string | undefined => {
  const pathName = usePathname()
  const params = useParams()

  if (typeof params.countryCode === "string") {
    return params.countryCode
  }

  if (countryOptions) {
    // Check if the path contains a country code and update the current path
    const pathParts = pathName.replace(/^\//, "").split("/")
    const firstPathPart = pathParts[0]

    if (pathParts.length > 1 && firstPathPart) {
      const country = countryOptions.find(
        (country) => country.country === firstPathPart
      )

      if (country) {
        return country.country
      }
    }
  } else {
    const pathParts = pathName.replace(/^\//, "").split("/")
    const firstPathPart = pathParts[0]

    if (pathParts.length > 1 && firstPathPart && firstPathPart.length === 2) {
      return firstPathPart
    }
  }

  return undefined
}
