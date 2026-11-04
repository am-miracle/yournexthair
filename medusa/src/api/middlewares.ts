import { defineMiddlewares } from '@medusajs/medusa';
import { authenticate } from '@medusajs/framework';
import { errorHandler } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import * as Sentry from '@sentry/node';
import { adminProductTypeRoutesMiddlewares } from './store/custom/product-types/middlewares';
import { validatePublishHairFields } from './admin/products/publish-validation-middleware';

const CLIENT_ERROR_TYPES = new Set<string>([
  MedusaError.Types.DUPLICATE_ERROR,
  MedusaError.Types.INVALID_ARGUMENT,
  MedusaError.Types.INVALID_DATA,
  MedusaError.Types.UNAUTHORIZED,
  MedusaError.Types.FORBIDDEN,
  MedusaError.Types.NOT_FOUND,
  MedusaError.Types.NOT_ALLOWED,
  MedusaError.Types.CONFLICT,
]);

const isClientError = (error: unknown) =>
  MedusaError.isMedusaError(error) && CLIENT_ERROR_TYPES.has(error.type);

const defaultErrorHandler = errorHandler();

export default defineMiddlewares({
  routes: [
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
  ],
  errorHandler: (error, req, res, next) => {
    if (!isClientError(error)) {
      Sentry.captureException(error, {
        tags: { method: req.method },
        extra: { path: req.path },
      });
    }

    defaultErrorHandler(error, req, res, next);
  },
});
