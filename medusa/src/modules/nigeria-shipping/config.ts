export const carrierIds = { fez: "nigeria_fez", gig: "nigeria_gig" } as const
export const carrierNames = { fez: "FEZ Delivery", gig: "GIG Logistics" } as const
export type Carrier = keyof typeof carrierIds

type Credentials = { username: string; password: string; live: boolean }
export type FezOptions = Credentials & { carrier: "fez" }
export type GigOptions = Credentials & { carrier: "gig"; geoapifyKey: string }
export type CarrierOptions = FezOptions | GigOptions

export function carrierForProvider(providerId: string): Carrier | undefined {
  return (Object.keys(carrierIds) as Carrier[]).find(
    (carrier) => carrierIds[carrier] === providerId,
  )
}

export function carrierOptions(carrier: Carrier): CarrierOptions | null {
  const prefix = carrier.toUpperCase()
  const username = process.env[`${prefix}_API_USERNAME`]
  const password = process.env[`${prefix}_API_PASSWORD`]
  if (!username || !password) return null
  const environment = process.env[`${prefix}_ENVIRONMENT`] ?? "sandbox"
  if (environment !== "sandbox" && environment !== "live") {
    throw new Error(`${prefix}_ENVIRONMENT must be sandbox or live.`)
  }
  const live = environment === "live"
  if (carrier === "fez") return { carrier, username, password, live }
  const geoapifyKey = process.env.GEOAPIFY_API_KEY
  return geoapifyKey ? { carrier, username, password, live, geoapifyKey } : null
}
