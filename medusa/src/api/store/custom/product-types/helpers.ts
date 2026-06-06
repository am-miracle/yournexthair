import type { MedusaContainer, ProductTypeDTO } from "@medusajs/framework/types"

export const refetchProductType = async (
  productTypeId: string,
  scope: MedusaContainer,
  fields: (keyof ProductTypeDTO)[]
): Promise<ProductTypeDTO> => {
  const query = scope.resolve("query")
  const { data: [productType] } = (await query.graph({
    entity: "product_type",
    filters: { id: productTypeId },
    fields,
  })) as { data: ProductTypeDTO[] }

  return productType!
}

export const listProductTypes = async (
  scope: MedusaContainer,
  filters: Record<string, unknown>,
  fields: string[],
  pagination: Record<string, unknown>,
) => {
  const query = scope.resolve("query")
  const { data: productTypes, metadata } = await query.graph({
    entity: "product_types",
    filters,
    fields,
    pagination,
  })

  return {
    productTypes,
    metadata,
  }
}
