import { defineMiddlewares } from '@medusajs/medusa';
import { adminProductTypeRoutesMiddlewares } from './store/custom/product-types/middlewares';
import { authenticate } from '@medusajs/framework';
import { validatePublishHairFields } from './admin/products/publish-validation-middleware';

export default defineMiddlewares([
  ...adminProductTypeRoutesMiddlewares,
  {
    method: ['POST', 'PUT'],
    matcher: '/admin/products/:id',
    middlewares: [validatePublishHairFields],
  },
  {
    method: 'ALL',
    matcher: '/store/custom/customer/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
]);
