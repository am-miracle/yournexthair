import {
  createSelectParams,
  createFindParams,
  createOperatorMap,
} from '@medusajs/medusa/api/utils/validators';
import { z } from '@medusajs/framework/zod';

export type AdminGetProductTypeParamsType = z.infer<
  typeof AdminGetProductTypeParams
>;
export const AdminGetProductTypeParams = createSelectParams();

interface AdminGetProductTypesParamsShape {
  limit?: number | undefined;
  offset?: number | undefined;
  fields?: string | undefined;
  order?: string | undefined;
  q?: string | undefined;
  id?: string | string[] | undefined;
  value?: string | string[] | undefined;
  created_at?: Record<string, unknown> | undefined;
  updated_at?: Record<string, unknown> | undefined;
  deleted_at?: Record<string, unknown> | undefined;
  $and?: AdminGetProductTypesParamsShape[] | undefined;
  $or?: AdminGetProductTypesParamsShape[] | undefined;
}

export type AdminGetProductTypesParamsType = AdminGetProductTypesParamsShape;

export const AdminGetProductTypesParams: z.ZodType<AdminGetProductTypesParamsShape> =
  createFindParams({
    limit: 10,
    offset: 0,
  }).extend({
    q: z.string().optional(),
    id: z.union([z.string(), z.array(z.string())]).optional(),
    value: z.union([z.string(), z.array(z.string())]).optional(),
    // TODO: To be added in next iteration
    // discount_condition_id: z.string().nullish(),
    created_at: createOperatorMap().optional(),
    updated_at: createOperatorMap().optional(),
    deleted_at: createOperatorMap().optional(),
    $and: z.lazy(() => AdminGetProductTypesParams.array()).optional(),
    $or: z.lazy(() => AdminGetProductTypesParams.array()).optional(),
  });
