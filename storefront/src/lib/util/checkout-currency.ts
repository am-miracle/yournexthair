export const checkoutCurrency = (countryCode: string) =>
  countryCode.toLowerCase() === "ng" ? "ngn" : "usd"
