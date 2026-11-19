import {
  createProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type MenuCategory = { handle: string; name: string; children?: MenuCategory[] }

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    handle: "bundles",
    name: "Hair Bundles",
    children: [
      { handle: "sa-curly", name: "SA Curly (Raw Curly)" },
      { handle: "raw-laos-wavy", name: "Raw Laos Wavy" },
      { handle: "dreamy-curly", name: "Dreamy Curly" },
      { handle: "slight-wavy", name: "Slight Wavy" },
      { handle: "deluxe-straight", name: "Deluxe Straight" },
    ],
  },
  { handle: "wigs", name: "Wigs" },
]

export default async function setupMenuCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const products = container.resolve(Modules.PRODUCT)

  const ensure = async (category: MenuCategory, rank: number, parentId: string | null) => {
    const [existing] = await products.listProductCategories({ handle: category.handle })
    const data = {
      name: category.name,
      rank,
      parent_category_id: parentId,
      is_active: true,
      is_internal: false,
    }

    if (existing) {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: existing.id }, update: data },
      })
      return existing.id
    }

    const {
      result: [created],
    } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: [{ handle: category.handle, ...data }] },
    })
    if (!created) throw new Error(`Could not create category ${category.name}`)
    logger.info(`Created category ${category.name}.`)
    return created.id
  }

  for (const [index, category] of MENU_CATEGORIES.entries()) {
    const id = await ensure(category, index, null)
    for (const [childIndex, child] of (category.children ?? []).entries()) {
      await ensure(child, childIndex, id)
    }
  }

  logger.info("Menu categories are ready. Assign products to them in the Medusa admin.")
}
