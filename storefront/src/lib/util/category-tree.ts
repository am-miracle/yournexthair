export type FlatCategory = {
  id: string
  name: string
  handle: string
  rank?: number | null
  parent_category_id?: string | null
}

export type CategoryNode = {
  id: string
  name: string
  handle: string
  children: CategoryNode[]
}

const byRank = (a: FlatCategory, b: FlatCategory) => (a.rank ?? 0) - (b.rank ?? 0)

export function buildCategoryTree(categories: FlatCategory[]): CategoryNode[] {
  const toNode = (category: FlatCategory): CategoryNode => ({
    id: category.id,
    name: category.name,
    handle: category.handle,
    children: categories
      .filter((child) => child.parent_category_id === category.id)
      .sort(byRank)
      .map(toNode),
  })

  return categories
    .filter((category) => !category.parent_category_id)
    .sort(byRank)
    .map(toNode)
}

export function withDescendantIds(categories: FlatCategory[], ids: string[]): string[] {
  const result = new Set(ids)
  let added = true
  while (added) {
    added = false
    for (const category of categories) {
      if (
        category.parent_category_id &&
        result.has(category.parent_category_id) &&
        !result.has(category.id)
      ) {
        result.add(category.id)
        added = true
      }
    }
  }
  return [...result]
}
