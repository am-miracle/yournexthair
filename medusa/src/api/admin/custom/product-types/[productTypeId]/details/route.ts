import { Modules } from '@medusajs/framework/utils';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from '@medusajs/framework/zod';

const productTypeFieldsMetadataSchema = z.object({
  image: z
    .object({
      id: z.string(),
      url: z.string().url(),
    })
    .optional(),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const productTypeId = req.params.productTypeId!;
  const productService = req.scope.resolve(Modules.PRODUCT);
  const productType = await productService.retrieveProductType(productTypeId);

  const parsed = productTypeFieldsMetadataSchema.safeParse(
    productType.metadata ?? {},
  );

  res.json({
    image: parsed.success && parsed.data.image ? parsed.data.image : null,
  });
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const productTypeId = req.params.productTypeId!;
  const body: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const customFields = productTypeFieldsMetadataSchema.parse(body);

  const productService = req.scope.resolve(Modules.PRODUCT);
  const productType = await productService.retrieveProductType(productTypeId);

  const updatedProductType = await productService.updateProductTypes(
    productTypeId,
    {
      metadata: {
        ...productType.metadata,
        ...customFields,
      },
    },
  );

  res.json(updatedProductType);
}
