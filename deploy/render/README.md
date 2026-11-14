# Render backends + Vercel frontends: development and production

The Render Blueprints provision backends and datastores only. The Next.js
frontends run on Vercel. These files do not provision or change live services.
**Both Blueprints currently use Render's free plans.** See
[Upgrading production](#upgrading-production) before taking real paid orders.
Render auto deploy is off. Vercel Git deployments are configured separately in its dashboard.

| Environment | Branch    | Render backend Blueprint                 | Vercel project     |
| ----------- | --------- | ---------------------------------------- | ------------------ |
| Development | `develop` | `deploy/render/backend.development.yaml` | `yournexthair-dev` |
| Production  | `master`  | `deploy/render/backend.production.yaml`  | `yournexthair`     |

Each backend uses a separate Neon database/branch, Redis-compatible Key Value, JWT/cookie
secrets, and storage credentials. Each Vercel frontend uses its matching backend
and publishable key. Copy that backend’s revalidation secret to the corresponding
Vercel project; cross-provider variables are not synchronized automatically.
Hosted dev uses production builds too: `NODE_ENV=production`,
`APP_ENV=development`. Neither application is a static export.

Both apps target Node 24 LTS (`24.x`), matching the Render Blueprints, Docker
image and CI. Vercel reads `storefront/package.json` for the Node major version.
The major is constrained to 24 while patch updates are picked up on new builds.
For local work, use `nvm install` and `nvm use` from the repository root.

## Start here: free setup

1. In Render → New → Blueprint, use the matching branch and backend Blueprint
   from the table. Both use `plan: free` for the backend; PostgreSQL is
   supplied by Neon. Development uses a free Render Key Value; production uses
   an external Redis (see [Production Redis](#production-redis)) because Render
   allows only one free Key Value per workspace.
2. Enter that environment's Neon `DATABASE_URL`, `STOREFRONT_URL`, your storage
   details (plus `REDIS_URL` on production), and
   `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` in Render's prompts.
   These Admin values must be your own and must not be committed to Git.
3. On startup, the free backend runs migrations, creates the initial Admin if
   absent, seeds regions, creates the Nigeria VAT rate at 0% if missing (change it in Admin once VAT-registered), enables Bachs on all
   regions when `BACHS_SECRET_KEY` is set, and starts Medusa. This replaces paid-only pre-deploy
   and Shell access. It does not create demo products or reset existing passwords.
4. Sign in at `<backend-url>/app`, remove both initial Admin variables from Render,
   and create the default sales channel and publishable API key in Admin.
5. Deploy the frontend on Vercel using the setup below and the matching backend.
   Your media storage account and Vercel plan have their own usage limits and
   terms; the Render free plans do not include object storage.

Free-tier constraints:

- No Render Postgres is provisioned. Neon has its own plan limits, retention and
  backup settings; verify those before relying on persistent client data.
- The web service sleeps after 15 idle minutes and has limited memory. This
  Medusa app may exceed the free instance's resources; upgrade if it runs out of
  memory. A free plan selection is not a guarantee that Medusa will fit.
- Redis data is lost on restart, including queued workflow jobs. Payment
  webhooks that arrive while the service sleeps wait for it to wake. This is
  fine for development, demos and a soft launch, not for real paid orders.
- No Render Shell, one-off jobs or persistent disks. Store uploads in external
  object storage. Free usage quotas still apply.

See https://render.com/docs/free for current platform limits.

## Before provisioning

1. Commit this setup to `master` and create/push `develop` from the intended test
   revision (or change the dev Blueprint branch to an existing test branch).
   Keep Blueprint files in both branches; the initial `develop` branch can use
   the same setup revision as `master`. To use master for both, change `branch` in the dev backend Blueprint and
   select `master` as the dev Vercel project’s Production Branch;
   data and services remain separate and releases remain manual.
2. Prepare separate S3-compatible buckets and credentials for dev and production.
   Use public media origins that serve uploaded images. Do not use local MinIO,
   localhost URLs, or Render's temporary filesystem for persistent media.
3. Keep Bachs, Resend, DHL, search and reporting credentials separate per
   environment. Use Bachs sandbox keys in development. Do not copy your local
   `.env` or production customer data into the dev stack.

## Backend configuration

In Render choose **New → Blueprint**, connect `am-miracle/yournexthair`, choose the
matching branch and specify the backend Blueprint path from the table. Render
allows a custom Blueprint path. Confirm the proposed plans and resources there.
Render services use Frankfurt. Use a nearby Neon region where possible; Neon
connections use its external TLS endpoint, while Redis remains on Render’s private network.

Supply these prompted variables (plus the initial Admin values on free plans):

- `DATABASE_URL`: the matching environment’s Neon PostgreSQL connection string.
  Use the direct endpoint for this configuration, which also runs migrations, and
  retain Neon’s TLS parameters (for example `sslmode=verify-full`). Supply the dev
  Neon URL as `DATABASE_URL` on dev and the production URL under the same key on
  prod. `DEV_DATABASE_URL` is not read by this app. Never commit either URL.
- `STOREFRONT_URL`: the public storefront origin you intend to use. For example,
  `https://yournexthair-dev.vercel.app` or your chosen custom domain. Vercel
  can assign a different hostname; use its actual stable project domain.
- `S3_FILE_URL`: public bucket/media origin; keep the trailing path if applicable.
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT`:
  the matching environment's object storage settings. Use `auto` for R2's region
  or the real region for S3. The Blueprint enables path-style requests; adjust
  `S3_FORCE_PATH_STYLE` for your provider if needed.

`DATABASE_URL` is entered in Render, not generated by the Blueprint. Neither
Blueprint creates a Render Postgres resource or sets `DATABASE_SSL_MODE=disable`.
If that variable exists on an already-created backend, remove it manually before
redeploying: omitting it from a Blueprint does not remove a saved Render variable.
Keep the Neon TLS connection parameters. Existing cloud databases are not deleted
by this repository edit; review any previously provisioned Render Postgres resource
separately and back it up before considering removal.

On development, `REDIS_URL` is wired using Render's private Key Value connection
string, with an empty public IP allow list. On production it is entered in
Render (see below). Redis must never evict keys because it holds workflow jobs
and locks as well as caches. Neither free Redis has persistence.

### Production Redis

Until production is upgraded, use a free Redis Cloud database (fixed price,
not billed per command):

1. Create a free database at https://redis.io/cloud in AWS `eu-central-1`
   (Frankfurt), next to the Render backend.
2. In its configuration, set the data eviction policy to `noeviction`.
3. Use its endpoint as `REDIS_URL`:
   `redis://default:<password>@<host>:<port>` (use `rediss://` if TLS is enabled).

Never point production at the development Key Value: both use the same queue
names. The free tier is small and caps connections; if Medusa logs Redis
connection or out-of-memory errors, upgrade as below.

The backend build installs all build dependencies, compiles Medusa/Admin, then
installs production dependencies in `.medusa/server`. On free plans the start
command runs migrations and the bootstrap script, then serves the compiled
server on port 9000. `/health` is the liveness probe.

Open `<actual-backend-url>/app` after the service is healthy. On a paid plan
with Render Shell (free plans bootstrap automatically), work from the compiled server directory (relative to `medusa`):

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

## Create the storefronts in Vercel

Use two Vercel projects for stable environment URLs and straightforward CORS and
backend revalidation. In each, import `am-miracle/yournexthair` and set:

| Setting                | Production project               | Development project |
| ---------------------- | -------------------------------- | ------------------- |
| Project name (example) | `yournexthair`                   | `yournexthair-dev`  |
| Root Directory         | `storefront`                     | `storefront`        |
| Framework              | Next.js                          | Next.js             |
| Production Branch      | `master`                         | `develop`           |
| Node.js                | 24.x                             | 24.x                |
| Install command        | `pnpm install --frozen-lockfile` | same                |
| Build command          | `pnpm build`                     | same                |
| Output Directory       | Leave Next.js default            | same                |

`storefront/vercel.json` already supplies the framework, install/build commands
and unchanged-build skipping. No Render storefront Blueprint is needed.

In Vercel → Project Settings → Environment Variables, add the following for the
**Production** target in each project. Both projects deploy their selected branch
to Vercel's Production target; the development project's app label is still
`development`. Vercel's Development target is for local development, not this
hosted dev site.

| Variable                             | Value for that project                         |
| ------------------------------------ | ---------------------------------------------- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL`     | Matching Render backend's public HTTPS URL     |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable key created in that backend        |
| `NEXT_PUBLIC_BASE_URL`               | Actual stable Vercel project/custom-domain URL |
| `NEXT_PUBLIC_DEFAULT_REGION`         | `ng`                                           |
| `STOREFRONT_REVALIDATE_SECRET`       | Exact secret from the matching Render backend  |
| `S3_FILE_URL`                        | Matching backend's public media origin         |
| `APP_ENV`                            | `production` or `development`                  |
| `NEXT_PUBLIC_APP_ENV`                | Same label as `APP_ENV`                        |
| `NEXT_PUBLIC_FEATURE_SEARCH_ENABLED` | `false` until search is configured             |
| `NEXT_PUBLIC_ENABLE_WEBMCP`          | `false` unless explicitly enabled              |
| `DISALLOW_ROBOTS`                    | `true` on dev; omit entirely on production     |

Do not copy database passwords, S3 private keys, Bachs secrets or DHL keys
into Vercel. Only the backend needs those. The revalidation secret stays
server-only: never prefix it with `NEXT_PUBLIC_`.

The backend must be healthy and have regions and a valid publishable key before
building the frontend; Next.js page generation reads catalog data. Deploy after
saving the variables. Environment changes require a new Vercel deployment.

After creation:

1. Set each Render backend's `STOREFRONT_URL` to its matching **stable** Vercel URL
   and redeploy the backend. CORS defaults derive from that and `BACKEND_URL`.
   This URL is also used for payment returns, emails, and product revalidation.
2. Add exact additional frontend origins to `STORE_CORS` and `AUTH_CORS` only if
   needed. Do not broadly allow every `vercel.app` deployment. Vercel preview URLs
   change; configure preview variables and origins explicitly if enabling them.
   Never let a feature-branch preview use production backend credentials by default.
3. Keep the stable development frontend reachable by backend revalidation calls.
   If Vercel Deployment Protection covers it, configure a deliberate backend
   access mechanism before relying on callbacks; this integration does not send
   a Vercel protection-bypass token.
4. On both stacks, check `/api/health`, `/ng`, a product image, Admin login, cart
   and addresses. Configure real inventory and shipping, and test a sandbox
   payment before enabling live payments. Use matching Bachs callback domains.

The dev site disallows robots; that is not access control. Use Vercel access
controls when needed, accounting for backend-to-frontend callbacks as above.
No storefront resources should be provisioned on Render. If you previously
created any, retire them manually after the Vercel deployment is verified; this
repository change does not delete cloud resources.

## Optional integrations (configure independently in each backend)

- Payments: `BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SECRET`. Webhook endpoint:
  `<backend>/hooks/payment/bachs_bachs`. Follow [Bachs setup](../../medusa/src/modules/bachs/README.md)
  for required scopes, webhook events and refund outcome tracking. Enable the provider on the regions.
  Changing env vars alone does not add it to existing regions. Remove manual/test
  payment providers from production regions before accepting customer orders.
- Email: `RESEND_API_KEY`, `RESEND_FROM` using your client's verified sender.
  Without a key, notifications use the local logging provider, not real email.
- Shipping: `DHL_API_USERNAME`, `DHL_API_PASSWORD`, `DHL_ACCOUNT_NUMBER`, then follow
  `medusa/src/modules/dhl-shipping/README.md`. There are no invented weights.
- Search: separate Meilisearch instances/credentials per environment. Set backend
  `MEILISEARCH_HOST`/`MEILISEARCH_API_KEY`; set storefront
  `NEXT_PUBLIC_SEARCH_ENDPOINT`, a **search-only** `NEXT_PUBLIC_SEARCH_API_KEY`,
  and `NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true`, then rebuild. Search is disabled
  by default so launch is not blocked by an absent search service.
- Error reporting: backend `SENTRY_DSN`, storefront `NEXT_PUBLIC_SENTRY_DSN`.
  APP_ENV labels keep development and production events distinct.

## Releases, backups and rollback

Test a revision in develop, merge the tested change into master, and manually
deploy the Render backend before promoting the Vercel storefront. Vercel can
automatically deploy pushes to its Production Branch: disable Git auto deployments
there if you need manual release coordination. Release the same tested commit
on both platforms. Database migrations must remain backward compatible with
the previous release: rolling back a web service does not roll back its database.
Confirm database backups and test restoration before accepting live orders.
Do not recreate production databases or rotate generated secrets as a routine
release step. Back up database and object storage before bulk data changes.

## Upgrading production

Before accepting real paid orders, edit `backend.production.yaml`:

- Web service: `plan: 1c-2g` (2 GB RAM), add
  `preDeployCommand: 'cd .medusa/server && pnpm exec medusa db:migrate'` and set
  `startCommand: cd .medusa/server && pnpm start`. Remove the two
  `INITIAL_ADMIN_*` variables.
- Redis: add a Render Key Value service and wire `REDIS_URL` to it:

  ```yaml
        - key: REDIS_URL
          fromService:
            type: keyvalue
            name: yournexthair-redis-prod
            property: connectionString
    - type: keyvalue
      name: yournexthair-redis-prod
      region: frankfurt
      plan: 256mb
      maxmemoryPolicy: noeviction
      persistenceMode: journal-snapshot
      ipAllowList: []
  ```

  After syncing, confirm the service's `REDIS_URL` points at the new Key Value,
  not Redis Cloud.

Changing a Blueprint does not change existing services: apply the plans in the
Render dashboard or sync the Blueprint, and confirm the bill before saving.

Each environment uses one Medusa shared worker/server instance.
Before scaling it, separate server/worker roles and review job execution, file
storage, readiness and account capacity. These YAMLs do not create extra workers,
public databases, Meilisearch instances, or migrate existing local data.

References: https://render.com/docs/blueprint-spec,
https://vercel.com/docs/git and https://vercel.com/docs/environment-variables
