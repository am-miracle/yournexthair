import { describe, expect, it } from "vitest"
import { parseClaimFragment } from "../claim-orders"

describe("parseClaimFragment", () => {
  it("reads order and token pairs from the URL fragment", () => {
    expect(
      parseClaimFragment(
        "#c=order_01ABC.0f8fad5b-d9cb-469f-a165-70867728950e,order_02DEF.7c9e6679-7425-40de-944b-e07fc1f90ae7",
      ),
    ).toEqual([
      { orderId: "order_01ABC", token: "0f8fad5b-d9cb-469f-a165-70867728950e" },
      { orderId: "order_02DEF", token: "7c9e6679-7425-40de-944b-e07fc1f90ae7" },
    ])
  })

  it("drops malformed and duplicate entries", () => {
    expect(
      parseClaimFragment(
        "#c=order_01ABC.tok-1,not-an-order.tok,order_02DEF.,order_01ABC.tok-2,order_03.<script>",
      ),
    ).toEqual([{ orderId: "order_01ABC", token: "tok-1" }])
  })

  it("returns nothing for an empty or unrelated fragment", () => {
    expect(parseClaimFragment("")).toEqual([])
    expect(parseClaimFragment("#section")).toEqual([])
  })

  it("caps the number of claims", () => {
    const many = Array.from({ length: 30 }, (_, i) => `order_${i}.tok${i}`).join(",")
    expect(parseClaimFragment(`#c=${many}`)).toHaveLength(20)
  })
})
