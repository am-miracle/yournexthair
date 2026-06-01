import { Module } from '@medusajs/utils';
import Loader from './loader';
import { MeilisearchService } from './service';

export default Module('meilisearchService', {
  service: MeilisearchService,
  loaders: [Loader],
});
