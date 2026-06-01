import { refetchProductType } from '../helpers';
import type { AdminGetProductTypeParamsType } from '../validators';
import type { ProductTypeDTO } from '@medusajs/framework/types';
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework';

export const GET = async (
  req: AuthenticatedMedusaRequest<AdminGetProductTypeParamsType>,
  res: MedusaResponse
) => {
  const productType = await refetchProductType(
    req.params.id!,
    req.scope,
    req.queryConfig.fields as (keyof ProductTypeDTO)[],
  );

  res.status(200).json({ product_type: productType });
};
