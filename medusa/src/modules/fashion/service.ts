import { MedusaError, MedusaService } from '@medusajs/framework/utils';
import Material from './models/material';
import Color from './models/color';

const PAGE_SIZE = 20;

export default class FashionModuleService extends MedusaService({
  Material,
  Color,
}) {
  private async assertMaterialExists(materialId: string) {
    return this.retrieveMaterial(materialId, { withDeleted: true });
  }

  async listMaterialsPage(page: number, deleted = false) {
    return this.listAndCountMaterials(
      deleted
        ? {
            deleted_at: { $lte: new Date() },
          }
        : undefined,
      {
        skip: PAGE_SIZE * (page - 1),
        take: PAGE_SIZE,
        withDeleted: deleted,
        relations: ['colors'],
      },
    );
  }

  createMaterial(name: string) {
    return this.createMaterials({ name });
  }

  updateMaterial(materialId: string, name: string) {
    return this.updateMaterials({
      id: materialId,
      name,
    });
  }

  deleteMaterial(materialId: string) {
    return this.softDeleteMaterials(materialId);
  }

  restoreMaterial(materialId: string) {
    return this.restoreMaterials(materialId);
  }

  async getMaterialDetails(materialId: string) {
    await this.assertMaterialExists(materialId);

    return this.retrieveMaterial(materialId, {
      relations: ['colors'],
      withDeleted: true,
    });
  }

  async listColorsPage(materialId: string, page: number, deleted = false) {
    await this.assertMaterialExists(materialId);

    return this.listAndCountColors(
      deleted
        ? {
            deleted_at: { $lte: new Date() },
            material_id: materialId,
          }
        : {
            material_id: materialId,
          },
      {
        skip: PAGE_SIZE * (page - 1),
        take: PAGE_SIZE,
        withDeleted: deleted,
      },
    );
  }

  createColor(materialId: string, input: { name: string; hex_code: string }) {
    return this.createColors({
      ...input,
      material_id: materialId,
    });
  }

  async getColorForMaterial(materialId: string, colorId: string) {
    await this.assertMaterialExists(materialId);

    const [color] = await this.listColors(
      {
        id: colorId,
        material_id: materialId,
      },
      {
        take: 1,
        withDeleted: true,
      },
    );

    if (!color) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Color ${colorId} was not found for material ${materialId}`,
      );
    }

    return color;
  }

  async updateColorForMaterial(
    materialId: string,
    colorId: string,
    input: { name: string; hex_code: string },
  ) {
    await this.getColorForMaterial(materialId, colorId);

    return this.updateColors({
      id: colorId,
      ...input,
    });
  }

  async deleteColorForMaterial(materialId: string, colorId: string) {
    await this.getColorForMaterial(materialId, colorId);
    await this.softDeleteColors(colorId);

    return this.retrieveColor(colorId, { withDeleted: true });
  }

  async restoreColorForMaterial(materialId: string, colorId: string) {
    await this.getColorForMaterial(materialId, colorId);
    await this.restoreColors(colorId);

    return this.retrieveColor(colorId, { withDeleted: true });
  }
}
