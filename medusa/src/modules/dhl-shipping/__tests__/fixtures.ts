import { buildQuoteRequest } from "../quote"
export const credentials = {
  username: "api-user",
  password: "api-password",
  account_number: "123456789",
}
export const settings = {
  name: "Box",
  environment: "sandbox",
  pickup_first_name: "Dispatch",
  pickup_last_name: "Contact",
  pickup_email: "dispatch@example.com",
  weight_grams: 100,
  length_cm: 30,
  width_cm: 25,
  height_cm: 10,
  max_items: 3,
  max_content_weight_grams: 2000,
  product_code: "",
}
export const address = {
  first_name: "Test",
  last_name: "Contact",
  phone: "+2348000000000",
  postal_code: "500001",
  address_1: "1 Test Street",
  city: "Port Harcourt",
  province: "Rivers",
  country_code: "ng",
}
export function parcel(international = false) {
  return buildQuoteRequest(
    { dhl_shipping: settings },
    {
      currency_code: "ngn",
      email: "customer@example.com",
      from_location: { address },
      shipping_address: {
        ...address,
        ...(international
          ? { country_code: "gb", province: "London", city: "London", postal_code: "SW1A 1AA" }
          : {}),
      },
      items: [
        {
          title: "Wig",
          quantity: 2,
          unit_price: 120000,
          variant: {
            weight: 250,
            length: 20,
            width: 15,
            height: 3,
            metadata: { hs_code: "670420", country_of_origin: "CN" },
          },
        },
      ],
    },
  ).body
}
