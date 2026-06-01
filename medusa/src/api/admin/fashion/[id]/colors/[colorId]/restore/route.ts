import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type FashionModuleService from '../../../../../../../modules/fashion/service';
import { FASHION_MODULE } from '../../../../../../../modules/fashion';

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const fashionModuleService: FashionModuleService =
    req.scope.resolve(FASHION_MODULE);

  const { id, colorId } = req.params as { id: string; colorId: string };

  await fashionModuleService.retrieveMaterial(id, {
    withDeleted: true,
  });

  await fashionModuleService.restoreColors(colorId);

  const color = await fashionModuleService.retrieveColor(colorId, {
    withDeleted: true,
  });

  res.status(200).json(color);
};
