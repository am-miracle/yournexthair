import { createHash } from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { optionSettingsSchema, dhlEnvironment } from "./config"
import type { DhlRate } from "./client"

export type ShippingContext = {
  currency_code?: unknown
  email?: unknown
  shipping_address?: Address | null | undefined
  from_location?: { address?: Address | null | undefined } | null | undefined
  items?: {
    title?: string
    quantity?: unknown
    unit_price?: unknown
    requires_shipping?: boolean | undefined
    variant?:
      | {
          weight?: unknown
          length?: unknown
          height?: unknown
          width?: unknown
          metadata?: Record<string, unknown> | null | undefined
        }
      | null
      | undefined
  }[]
}
type Address = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  country_code?: string | null
  postal_code?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}
const invalid = (message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}
const positive = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return invalid(`${label} is missing or invalid. Please contact the store.`)
  }
  return value
}

const nigerianStates: Record<string, string> = {
  ab: "Abia",
  ad: "Adamawa",
  ak: "Akwa Ibom",
  an: "Anambra",
  ba: "Bauchi",
  by: "Bayelsa",
  be: "Benue",
  bo: "Borno",
  cr: "Cross River",
  de: "Delta",
  eb: "Ebonyi",
  ed: "Edo",
  ek: "Ekiti",
  en: "Enugu",
  fc: "Abuja",
  go: "Gombe",
  im: "Imo",
  ji: "Jigawa",
  kd: "Kaduna",
  kn: "Kano",
  kt: "Katsina",
  ke: "Kebbi",
  ko: "Kogi",
  kw: "Kwara",
  la: "Lagos",
  na: "Nasarawa",
  ni: "Niger",
  og: "Ogun",
  on: "Ondo",
  os: "Osun",
  oy: "Oyo",
  pl: "Plateau",
  ri: "Rivers",
  so: "Sokoto",
  ta: "Taraba",
  yo: "Yobe",
  za: "Zamfara",
}
function dhlAddress(address: Address | null | undefined, label: string, requireName = false) {
  if (
    !address?.city?.trim() ||
    !address.province?.trim() ||
    !address.country_code?.trim() ||
    !address.address_1?.trim()
  ) {
    return invalid(
      `${label} needs a street address, city, state and country before shipping can be quoted.`,
    )
  }
  if (
    !address.phone?.trim() ||
    !address.postal_code?.trim() ||
    (requireName && (!address.first_name?.trim() || !address.last_name?.trim()))
  ) {
    return invalid(
      `${label} needs a contact name, phone number and postal code before shipping can be quoted.`,
    )
  }
  const country = address.country_code.toUpperCase()
  const province = address.province.trim()
  const state =
    country === "NG"
      ? (nigerianStates[province.toLowerCase().replace(/^ng-/, "")] ?? province)
      : province
  return {
    city: address.city.trim(),
    state,
    country,
    line1: address.address_1.trim(),
    line2: address.address_2 ?? "",
    first_name: address.first_name ?? "",
    last_name: address.last_name ?? "",
    phone: address.phone ?? "",
    zip: address.postal_code ?? "",
  }
}

export function buildQuoteRequest(optionData: Record<string, unknown>, context: ShippingContext) {
  const parsed = optionSettingsSchema.safeParse(optionData.dhl_shipping)
  if (!parsed.success) {
    return invalid("Shipping packaging has not been configured. Please contact the store.")
  }
  const settings = parsed.data
  if (settings.environment !== dhlEnvironment()) {
    return invalid(
      "Shipping packaging belongs to another DHL environment. Configure this package again.",
    )
  }
  const currency =
    typeof context.currency_code === "string" ? context.currency_code.toUpperCase() : ""
  if (!currency) {
    return invalid("A cart currency is required for shipping.")
  }
  const pickupAddress = {
    ...dhlAddress(context.from_location?.address, "Pickup location"),
    first_name: settings.pickup_first_name,
    last_name: settings.pickup_last_name,
    email: settings.pickup_email,
  }
  const deliveryAddress = {
    ...dhlAddress(context.shipping_address, "Delivery address", true),
    email: typeof context.email === "string" ? context.email : "",
  }
  const box = [settings.length_cm, settings.width_cm, settings.height_cm].sort((a, b) => a - b)
  let count = 0
  let weightGrams = 0
  let volume = 0
  const international =
    context.from_location?.address?.country_code?.toLowerCase() !==
    context.shipping_address?.country_code?.toLowerCase()
  const items = (context.items ?? [])
    .filter((item) => item.requires_shipping !== false)
    .map((item) => {
      const quantity = positive(item.quantity, "Item quantity")
      if (!Number.isInteger(quantity)) {
        return invalid("Item quantity must be a whole number.")
      }
      const label = item.title || "Product"
      const weight = positive(item.variant?.weight, `${label}: variant weight (grams)`)
      const dimensions = [
        positive(item.variant?.length, `${label}: variant package length (cm)`),
        positive(item.variant?.width, `${label}: variant package width (cm)`),
        positive(item.variant?.height, `${label}: variant package height (cm)`),
      ].sort((a, b) => a - b)
      if (dimensions.some((dimension, index) => dimension > (box[index] ?? 0))) {
        return invalid(
          `${label} does not fit the configured shipping package. Please contact the store.`,
        )
      }
      count += quantity
      weightGrams += weight * quantity
      volume += dimensions.reduce((total, dimension) => total * dimension, 1) * quantity
      const unitPrice = Number(item.unit_price)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return invalid("Product value is invalid for shipping.")
      }
      const hsCode = item.variant?.metadata?.hs_code
      const origin = item.variant?.metadata?.country_of_origin
      if (international && (typeof hsCode !== "string" || !/^\d{6,10}$/.test(hsCode))) {
        return invalid(
          `${label} needs a valid customs HS code before international shipping can be quoted.`,
        )
      }
      if (international && (typeof origin !== "string" || !/^[A-Za-z]{2}$/.test(origin))) {
        return invalid(
          `${label} needs its actual two-letter country of origin before international shipping can be quoted.`,
        )
      }
      return {
        name: label,
        description: label,
        type: "parcel",
        quantity,
        weight: weight / 1000,
        value: unitPrice * quantity,
        currency,
        ...(international ? { hs_code: hsCode } : {}),
        ...(international ? { country_of_origin: String(origin).toUpperCase() } : {}),
      }
    })
  if (!items.length) {
    return invalid("There are no shippable items in this cart.")
  }
  if (
    count > settings.max_items ||
    weightGrams > settings.max_content_weight_grams ||
    volume > settings.length_cm * settings.width_cm * settings.height_cm
  ) {
    return invalid(
      "This order exceeds the configured shipping package capacity. Please contact the store for delivery.",
    )
  }
  const body = {
    pickup_address: pickupAddress,
    delivery_address: deliveryAddress,
    parcel: {
      description: "Hair products",
      weight_unit: "kg",
      weight: (weightGrams + settings.weight_grams) / 1000,
      dimensions: {
        length: settings.length_cm,
        width: settings.width_cm,
        height: settings.height_cm,
      },
      items,
    },
    currency,
  }
  return {
    body,
    fingerprint: createHash("sha256")
      .update(
        JSON.stringify({
          body,
          product_code: settings.product_code,
          environment: settings.environment,
        }),
      )
      .digest("hex"),
    settings,
  }
}

export function selectRate(
  rates: DhlRate[],
  currency: string,
  productCode: string,
  localProductCode?: string,
) {
  const eligible = rates.filter(
    (rate) =>
      rate.currency.toUpperCase() === currency.toUpperCase() &&
      (!productCode || rate.product_code === productCode) &&
      (!localProductCode || rate.local_product_code === localProductCode),
  )
  const rate = eligible.sort((a, b) => a.amount - b.amount)[0]
  if (!rate) {
    return invalid(
      "No DHL service is available for this address, parcel and currency. Please contact the store.",
    )
  }
  return rate
}
