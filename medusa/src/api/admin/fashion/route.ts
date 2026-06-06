import { z } from '@medusajs/framework/zod';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type FashionModuleService from '../../../modules/fashion/service';
import { FASHION_MODULE } from '../../../modules/fashion';

const materialsListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  deleted: z.coerce.boolean().optional().default(false),
});

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { page, deleted } = materialsListQuerySchema.parse(req.query);

  const fashionModuleService: FashionModuleService =
    req.scope.resolve(FASHION_MODULE);

  const [materials, count] = await fashionModuleService.listMaterialsPage(page, deleted);

  const last_page = Math.ceil(count / 20);

  res.status(200).json({ materials, count, page, last_page });
};

const createMaterialBodySchema = z.object({
  name: z.string().min(1),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const fashionModuleService: FashionModuleService =
    req.scope.resolve(FASHION_MODULE);

  const body: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const validatedData = createMaterialBodySchema.parse(body);

  const material = await fashionModuleService.createMaterial(validatedData.name);

  res.status(201).json(material);
};
