import type { HttpTypes } from '@medusajs/framework/types';
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';
import { listProductTypes } from './helpers';

export const GET = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminProductTypeListParams>,
  res: MedusaResponse,
) => {
  const { productTypes, metadata } = await listProductTypes(
    req.scope,
    req.filterableFields,
    req.queryConfig.fields,
    req.queryConfig.pagination,
  )

  res.json({
    product_types: productTypes,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  });
};
