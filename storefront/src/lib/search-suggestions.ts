export type SearchSuggestionPrice = {
  calculated_price_number: number
  calculated_price: string
  original_price_number: number | null
  original_price: string
  currency_code: string | null
  price_type: string | null | undefined
  percentage_diff: string
} | null

export type SearchSuggestionItem = {
  id: string
  handle: string
  title: string
  thumbnail: string
  variants: string[]
  price: SearchSuggestionPrice
}
