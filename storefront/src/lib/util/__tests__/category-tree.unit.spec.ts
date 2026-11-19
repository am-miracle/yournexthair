import { describe, it, expect } from "vitest"
import { buildCategoryTree, withDescendantIds } from "../category-tree"

const categories = [
  { id: "wigs", name: "Wigs", handle: "wigs", rank: 1, parent_category_id: null },
  {
    id: "straight",
    name: "Deluxe Straight",
    handle: "deluxe-straight",
    rank: 1,
    parent_category_id: "bundles",
  },
  { id: "bundles", name: "Hair Bundles", handle: "bundles", rank: 0, parent_category_id: null },
  { id: "curly", name: "SA Curly", handle: "sa-curly", rank: 0, parent_category_id: "bundles" },
]

describe("buildCategoryTree", () => {
  it("nests children under their parent and orders every level by rank", () => {
    const tree = buildCategoryTree(categories)

    expect(tree.map((c) => c.handle)).toEqual(["bundles", "wigs"])
    expect(tree[0]?.children.map((c) => c.handle)).toEqual(["sa-curly", "deluxe-straight"])
    expect(tree[1]?.children).toEqual([])
  })
})

describe("withDescendantIds", () => {
  it("adds the children of a selected parent", () => {
    expect(withDescendantIds(categories, ["bundles"]).sort()).toEqual(
      ["bundles", "curly", "straight"].sort(),
    )
  })

  it("leaves a selected child on its own", () => {
    expect(withDescendantIds(categories, ["curly"])).toEqual(["curly"])
  })
})
