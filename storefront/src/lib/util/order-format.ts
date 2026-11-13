const TIME_ZONE = "Africa/Lagos"

export const formatOrderDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(value))

export const formatOrderDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value))

export type OrderStage = "canceled" | "delivered" | "shipped" | "processing"

export function getOrderStage(order: { status?: string | null; fulfillment_status?: string | null }): OrderStage {
  if (order.status === "canceled" || order.fulfillment_status === "canceled") return "canceled"
  if (order.fulfillment_status === "delivered") return "delivered"
  if (["shipped", "partially_shipped", "partially_delivered"].includes(order.fulfillment_status ?? "")) return "shipped"
  return "processing"
}

type AddressLike = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  phone?: string | null
  country?: { display_name?: string | null } | null
} | null | undefined

export function formatAddressLines(address: AddressLike): string[] {
  if (!address) return []
  const join = (parts: (string | null | undefined)[], separator: string) => parts.filter((part) => part?.trim()).join(separator)
  return [
    join([address.first_name, address.last_name], " "),
    address.company,
    address.address_1,
    address.address_2,
    join([address.city, join([address.province, address.postal_code], " ")], ", "),
    address.country?.display_name,
    address.phone,
  ].filter((line): line is string => Boolean(line?.trim()))
}

export function isValidReturnPath(path: string | undefined, countryCode: string): path is string {
  return typeof path === "string" && path.startsWith(`/${countryCode}/`) && !path.includes("//") && !path.includes("\\")
}
