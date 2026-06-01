import type { HttpTypes } from '@medusajs/framework/types';
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';

export const GET = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminProductTypeListParams>,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve("query")
  const { data: productTypes, metadata } = await query.graph({
    entity: "product_types",
    filters: req.filterableFields,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination
  })

  res.json({
    product_types: productTypes,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  });
};
