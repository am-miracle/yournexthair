import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules } from '@medusajs/framework/utils';
import type { ISearchService, ProductDTO } from '@medusajs/framework/types';

const retrieveProductsStep = createStep(
  {
    name: 'retrieveProductsStep',
  },
  async (_, context) => {
    const productModuleService = context.container.resolve(Modules.PRODUCT);

    const products = await productModuleService.listProducts(undefined, {
      relations: [
        'variants',
        'options',
        'tags',
        'collection',
        'type',
        'images',
      ],
    });

    return new StepResponse(products);
  },
);

const indexProductsStep = createStep(
  {
    name: 'indexProductsStep',
  },
  async (input: ProductDTO[], context) => {
    const meilisearchService: ISearchService = context.container.resolve(
      'meilisearchService',
    );
    const result = await meilisearchService.addDocuments(
      'products',
      input,
      'products',
    );
    return new StepResponse(result);
  },
);

export const indexProductsWorkflow = createWorkflow(
  {
    name: 'indexProducts',
    idempotent: true,
    retentionTime: 60 * 60 * 24 * 3, // 3 days
    store: true,
  },
  () => {
    const products = retrieveProductsStep();
    return new WorkflowResponse(indexProductsStep(products));
  },
);
