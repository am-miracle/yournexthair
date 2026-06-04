import { HttpTypes } from "@medusajs/types"

const addressKeys = [
  "first_name",
  "last_name",
  "address_1",
  "address_2",
  "company",
  "postal_code",
  "city",
  "country_code",
  "province",
  "phone",
] as const

export default function compareAddresses(
  address1: Pick<
    HttpTypes.StoreCartAddress,
    | "first_name"
    | "last_name"
    | "address_1"
    | "address_2"
    | "company"
    | "postal_code"
    | "city"
    | "country_code"
    | "province"
    | "phone"
  >,
  address2: Pick<
    HttpTypes.StoreCartAddress,
    | "first_name"
    | "last_name"
    | "address_1"
    | "address_2"
    | "company"
    | "postal_code"
    | "city"
    | "country_code"
    | "province"
    | "phone"
  >
) {
  return addressKeys.every((key) => address1[key] === address2[key])
}
