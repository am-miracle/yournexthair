import type { LoaderOptions } from '@medusajs/types';
import { MeilisearchService } from './service';
import type { MeilisearchPluginOptions } from './types';
import { asValue } from 'awilix';

export default async ({
  container,
  options,
}: LoaderOptions<MeilisearchPluginOptions>): Promise<void> => {
  if (!options) {
    throw new Error('Missing meilisearch configuration');
  }

  const meilisearchService: MeilisearchService = new MeilisearchService(
    container,
    options,
  );

  container.register({
    meilisearchService: asValue(meilisearchService),
  });

  if (options.settings) {
    await Promise.all(
      Object.entries(options.settings).map(([indexName, indexSettings]) =>
        meilisearchService.updateSettings(indexName, indexSettings),
      ),
    );
  }
};
