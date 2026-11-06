# Render: development and production

These Blueprints create two independent stacks. They are not yet deployed.
All resources are paid plans; check Render's current pricing before creating them.
Auto deploy is off on both stacks so a push cannot release code unexpectedly.

| Environment | Source branch | Backend Blueprint | Storefront Blueprint |
| --- | --- | --- | --- |
| Development | `develop` | `deploy/render/backend.development.yaml` | `deploy/render/storefront.development.yaml` |
| Production | `master` | `deploy/render/backend.production.yaml` | `deploy/render/storefront.production.yaml` |

Each environment has its own Medusa web service (shared server/worker), Next.js
web service, Postgres 16 database, Redis-compatible Key Value instance, JWT and
cookie secrets, and shared backend/storefront revalidation secret. Hosted dev
runs production builds too: `NODE_ENV=production`, `APP_ENV=development`.
Neither service is a static site. Error reporting uses the deployment label.

## Before provisioning

1. Commit this setup to `master` and create/push `develop` from the intended test
   revision (or change the dev Blueprint branch to an existing test branch).
   Keep Blueprint files in both branches; the initial `develop` branch can use
   the same setup revision as `master`. To use master for both, change `branch` in both dev Blueprints;
   data and services remain separate and releases remain manual.
2. Prepare separate S3-compatible buckets and credentials for dev and production.
   Use public media origins that serve uploaded images. Do not use local MinIO,
   localhost URLs, or Render's temporary filesystem for persistent media.
3. Keep Bachs, Resend, Terminal, search and reporting credentials separate per
   environment. Use Bachs sandbox keys in development. Do not copy your local
   `.env` or production customer data into the dev stack.

## Create the backend first (repeat per environment)

In Render choose **New → Blueprint**, connect `am-miracle/yournexthair`, choose the
matching branch and specify the backend Blueprint path from the table. Render
allows a custom Blueprint path. Confirm the proposed plans and resources there.
The examples use Frankfurt for all services to allow private database connections.

Supply these prompted variables:

- `STOREFRONT_URL`: the public storefront origin you intend to use. For example,
  `https://yournexthair-web-dev.onrender.com` or your chosen custom domain. Render
  can assign a different hostname; correct this after creating the storefront.
- `S3_FILE_URL`: public bucket/media origin; keep the trailing path if applicable.
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT`:
  the matching environment's object storage settings. Use `auto` for R2's region
  or the real region for S3. The Blueprint enables path-style requests; adjust
  `S3_FORCE_PATH_STYLE` for your provider if needed.

Postgres and Key Value URLs are wired using Render's private connection strings.
Their public IP allow lists are empty; no external database/Redis access is
needed. Redis has persistence and no eviction because it holds workflow jobs and
locks as well as caches. Database SSL is explicitly disabled only for this
private Render connection; remove that setting when using an external TLS DB.

The backend build installs all build dependencies, compiles Medusa/Admin, then
installs production dependencies in `.medusa/server`. The pre-deploy command runs
migrations once before release. The start command serves the compiled server on
port 9000. `/health` is the liveness probe.

Open `<actual-backend-url>/app` after the service is healthy. In the backend's
Render Shell, work from the compiled server directory (relative to `medusa`):

```sh
cd .medusa/server
pnpm exec medusa user -e YOUR_ADMIN_EMAIL -p 'YOUR_CHOSEN_PASSWORD'
pnpm exec medusa exec ./src/scripts/seed-regions.js
```

The admin credentials are supplied by you, not stored in the repo. The focused
region seed is repeatable and creates Nigeria/NGN and International/USD without
creating demo products, customers or orders. Keep unsupported delivery countries
disabled for checkout until shipping is configured.

In Admin, create or select the default sales channel, assign it to the store,
then create a publishable API key and attach it to that channel. Keep this key
for the matching storefront. After creating the storefront below and correcting its URL, for the
**development stack only** you can load the demo catalog using `pnpm exec medusa exec ./src/scripts/seed-catalog.js`
after setting the real `STOREFRONT_URL`. Production catalog and stock should be
entered/reviewed by the client; never run the full demo seed on production.

## Create the storefront second

Create another Blueprint from the matching storefront YAML path. Its service
references the already-created matching backend for its URL, media origin, and
revalidation secret. Enter that backend's publishable API key when prompted.

The build runs pnpm and Next.js using Node 22.23.4. The start command binds to
`0.0.0.0:$PORT`. `/api/health` is a catalog-independent liveness endpoint.
The backend must be healthy and have regions and a valid publishable key before
Next.js builds, because page generation reads catalog data.

After creation:

1. Set the backend `STOREFRONT_URL` to the **actual** public storefront URL and
   redeploy it. CORS defaults derive from `BACKEND_URL` and `STOREFRONT_URL`.
   Set explicit `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` only for extra origins.
2. Check the frontend `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and
   `NEXT_PUBLIC_BASE_URL` use public HTTPS origins. The browser must never receive
   Render private service hostnames. For custom domains, override `BACKEND_URL`
   and `NEXT_PUBLIC_BASE_URL` in the Blueprints too so a sync does not undo them.
3. If backend variables referenced by the storefront change, sync the storefront
   Blueprint and redeploy it. Render references update on sync; Next.js public
   environment variables are baked into the frontend build.
4. Check `/ng`, a product image, Admin login, cart and address submission.
   Configure real inventory, shipping profiles/zones and package measurements.
   Verify shipping charges and a sandbox payment before enabling live payments.

The dev site disallows robots. This is not access control: enable Render access
controls if the test environment must be private. The production site is not
subject to the dev robots setting.

## Optional integrations (configure independently in each backend)

- Payments: `BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SECRET`. Webhook endpoint:
  `<backend>/hooks/payment/bachs_bachs`. Enable the provider on the regions.
  Changing env vars alone does not add it to existing regions. Remove manual/test
  payment providers from production regions before accepting customer orders.
- Email: `RESEND_API_KEY`, `RESEND_FROM` using your client's verified sender.
  Without a key, notifications use the local logging provider, not real email.
- Shipping: `TERMINAL_SECRET_KEY`, then follow
  `medusa/src/modules/terminal-shipping/README.md`. There are no invented weights.
- Search: separate Meilisearch instances/credentials per environment. Set backend
  `MEILISEARCH_HOST`/`MEILISEARCH_API_KEY`; set storefront
  `NEXT_PUBLIC_SEARCH_ENDPOINT`, a **search-only** `NEXT_PUBLIC_SEARCH_API_KEY`,
  and `NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true`, then rebuild. Search is disabled
  by default so launch is not blocked by an absent search service.
- Error reporting: backend `SENTRY_DSN`, storefront `NEXT_PUBLIC_SENTRY_DSN`.
  APP_ENV labels keep development and production events distinct.

## Releases, backups and rollback

Test a revision in develop, merge the tested change into master, and manually
deploy the backend before the storefront. Deploy the same commit across both
production services. Database migrations must remain backward compatible with
the previous release: rolling back a web service does not roll back its database.
Confirm database backups and test restoration before accepting live orders.
Do not recreate production databases or rotate generated secrets as a routine
release step. Back up database and object storage before bulk data changes.

The initial setup uses one Medusa shared worker/server instance per environment.
Before scaling it, separate server/worker roles and review job execution, file
storage, readiness and account capacity. These YAMLs do not create extra workers,
public databases, Meilisearch instances, or migrate existing local data.

References: https://render.com/docs/blueprint-spec and
https://render.com/docs/monorepo-support
