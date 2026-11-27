// Courier address fields (DHL) accept at most 45 characters each.
export const ADDRESS_FIELD_MAX_LENGTH = 45

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
].map((label) => ({ value: label.toLowerCase(), label }))

NIGERIAN_STATES.push({ value: "fct", label: "Federal Capital Territory (Abuja)" })

export const isNigeria = (countryCode?: string | null) => countryCode?.toLowerCase() === "ng"

export function nigerianStateValue(province?: string | null) {
  const state = province
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ state$/, "")
  if (!state) {
    return null
  }
  if (["abuja", "abuja fct", "federal capital territory"].includes(state)) {
    return "fct"
  }
  return NIGERIAN_STATES.some((option) => option.value === state) ? state : null
}

export function normalizePhone(value: string, countryCode?: string | null) {
  let phone = value.trim().replace(/[\s\-().]/g, "")
  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`
  }
  if (isNigeria(countryCode)) {
    if (/^0\d{10}$/.test(phone)) {
      return `+234${phone.slice(1)}`
    }
    if (/^234\d{10}$/.test(phone)) {
      return `+${phone}`
    }
    if (/^[789]\d{9}$/.test(phone)) {
      return `+234${phone}`
    }
  }
  return phone
}

export function isValidPhone(phone: string, countryCode?: string | null) {
  return isNigeria(countryCode) ? /^\+234[1-9]\d{7,9}$/.test(phone) : /^\+?\d{7,15}$/.test(phone)
}

export function provinceLabel(province?: string | null, countryCode?: string | null) {
  const state = isNigeria(countryCode) ? nigerianStateValue(province) : null
  return NIGERIAN_STATES.find((option) => option.value === state)?.label ?? province ?? ""
}

export function cityLine(
  address?: {
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
  } | null,
) {
  return [
    address?.city,
    provinceLabel(address?.province, address?.country_code),
    address?.postal_code,
  ]
    .filter(Boolean)
    .join(", ")
}
