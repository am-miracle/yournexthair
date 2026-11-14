# Brimble: backend, Redis and storefront

An alternative to the [Render + Vercel setup](../render/README.md) that puts
the Medusa backend, Redis and the Next.js storefront on Brimble. PostgreSQL
stays on Neon and media on Cloudflare R2 (or another S3-compatible bucket).
Nothing here provisions cloud resources; every step is done in the Brimble
dashboard.

Brimble's dashboard labels and database features were not verified against
live documentation when this was written. Confirm each item marked **Check**
before relying on it, and run the [dev-stack trial](#dev-stack-trial) before
moving production.

| Environment | Branch    | Backend                | Redis                    | Storefront         |
| ----------- | --------- | ---------------------- | ------------------------ | ------------------ |
| Development | `develop` | `yournexthair-api-dev` | `yournexthair-redis-dev` | `yournexthair-dev` |
| Production  | `master`  | `yournexthair-api`     | `yournexthair-redis`     | `yournexthair`     |

Keep every environment fully separate: its own Neon branch, Redis, bucket,
secrets, Bachs keys and publishable key. Never point two environments at the
same Redis database.

## Why Redis placement matters

Medusa's event bus and workflow engine run BullMQ queues on Redis. Their
workers poll Redis continuously, even with no traffic, so per-command billed
Redis (such as Upstash pay-as-you-go) is a poor fit. A Redis container billed
by CPU/RAM has no per-command cost. Redis also holds queued jobs and locks, so
it must persist writes and never evict keys.

## 1. Region

Use one region for backend, Redis and storefront. Germany is closest to the
Render/Vercel setup and to a Frankfurt Neon project; Nigeria lowers latency for
customers. Pick the Neon region closest to the chosen Brimble region.

## 2. Redis

Create a managed Redis database in the chosen region.

**Check**, then connect with `redis-cli -u "$REDIS_URL"` and verify:

```sh
CONFIG GET appendonly        # must be "yes"
CONFIG GET appendfsync       # "everysec"
CONFIG GET maxmemory-policy  # must be "noeviction"
CONFIG GET maxmemory         # comfortably above usage; 256mb to start
```

If a value is wrong, set it with `CONFIG SET` and `CONFIG REWRITE`. If the
managed database does not allow that, run Redis as a regular Brimble service
from the `redis:7-alpine` image with a persistent disk mounted at `/data` and
this command:

```sh
redis-server --appendonly yes --appendfsync everysec --maxmemory 256mb --maxmemory-policy noeviction --requirepass "$REDIS_PASSWORD"
```

Also **check**:

- the backend can reach Redis over a private/internal address, not the public internet;
- the connection limit (Medusa opens several connections per queue);
- that the persistent volume survives a restart: `SET probe 1`, restart, `GET probe`.

Development may skip AOF to save resources; jobs are then lost on restart.

## 3. Backend

Create a project from `am-miracle/yournexthair` on the environment's branch.

| Setting         | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Root directory  | `medusa`                                                                                                               |
| Node version    | 24.x                                                                                                                   |
| Install command | `corepack enable && pnpm install --frozen-lockfile --prod=false`                                                       |
| Build command   | `pnpm build && cp pnpm-lock.yaml .npmrc .medusa/server/ && cd .medusa/server && pnpm install --frozen-lockfile --prod` |
| Start command   | see below                                                                                                              |
| Port            | `9000`                                                                                                                 |
| Health check    | `/health`                                                                                                              |
| Resources       | 1 vCPU / 2 GB RAM minimum                                                                                              |
| Auto deploy     | off                                                                                                                    |

Start commands (migrations run on start because no pre-deploy step is assumed):

- Production: `cd .medusa/server && pnpm exec medusa db:migrate && pnpm start`
- Development: `cd .medusa/server && pnpm exec medusa db:migrate && pnpm exec medusa exec ./src/scripts/bootstrap-render-free.js && pnpm start`

The bootstrap script is platform-neutral despite its name: it creates the
initial Admin from `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` if absent and
seeds regions. Production can use it too for the first deploy, then switch to
the production start command.

Alternatively deploy `medusa/Dockerfile`, passing `BACKEND_URL` and
`STOREFRONT_URL` as build arguments; its start command already migrates.

**Check** that the service never sleeps. Bachs webhooks and scheduled jobs need
it always on.

### Backend environment variables

| Variable                                                               | Value                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`                                                             | `production`                                                       |
| `APP_ENV`                                                              | `production` or `development`                                      |
| `HOST`                                                                 | `0.0.0.0`                                                          |
| `PORT`                                                                 | `9000`                                                             |
| `MEDUSA_WORKER_MODE`                                                   | `shared`                                                           |
| `DATABASE_URL`                                                         | Matching Neon connection string (direct endpoint, keep TLS params) |
| `REDIS_URL`                                                            | Matching Brimble Redis connection string (private address)         |
| `BACKEND_URL`                                                          | Backend's public HTTPS URL                                         |
| `STOREFRONT_URL`                                                       | Storefront's stable public URL                                     |
| `JWT_SECRET`, `COOKIE_SECRET`                                          | New random values per environment (`openssl rand -hex 32`)         |
| `STOREFRONT_REVALIDATE_SECRET`                                         | New random value; copy to the matching storefront                  |
| `S3_FILE_URL`                                                          | Public media origin                                                |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_ENDPOINT` | Bucket credentials                                                 |
| `S3_REGION`                                                            | `auto` for R2                                                      |
| `S3_FORCE_PATH_STYLE`                                                  | `true`                                                             |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`                        | First deploy only; remove after signing in                         |

`BACKEND_URL` is baked into the Admin at build time: redeploy after changing it.
Do not set `DATABASE_SSL_MODE`. Optional integrations (Bachs, Resend, DHL,
Meilisearch, Sentry) use the same variables as in the
[Render guide](../render/README.md#optional-integrations-configure-independently-in-each-backend).
The Bachs webhook endpoint is `<backend>/hooks/payment/bachs_bachs`.

After the first healthy deploy, sign in at `<backend>/app`, remove the initial
Admin variables, then create the default sales channel and a publishable API
key attached to it.

## 4. Storefront

Create a second project from the same repository and branch.

| Setting         | Value                                          |
| --------------- | ---------------------------------------------- |
| Root directory  | `storefront`                                   |
| Framework       | Next.js (server-rendered, not a static export) |
| Node version    | 24.x                                           |
| Install command | `pnpm install --frozen-lockfile`               |
| Build command   | `pnpm build`                                   |
| Start command   | `pnpm start`                                   |

Use the storefront variables from the
[Render guide's Vercel table](../render/README.md#create-the-storefronts-in-vercel),
pointing `NEXT_PUBLIC_MEDUSA_BACKEND_URL` at the Brimble backend and copying
`STOREFRONT_REVALIDATE_SECRET` from it. `storefront/vercel.json` is ignored here.

The backend must be healthy with regions and a valid publishable key before the
storefront builds, because page generation reads catalog data. Once the
storefront has its stable URL, set the backend's `STOREFRONT_URL` to it and
redeploy the backend.

## 5. Database backups

Keep Neon for PostgreSQL unless Brimble's managed Postgres offers backups and
point-in-time restore at least as good. Either way, confirm backups and test a
restore before taking live orders.

## Dev-stack trial

Run on the development stack before moving production:

1. Redis settings above verified, and the `probe` key survives a restart.
2. Backend idles for 24 hours without sleeping: `/health` responds immediately
   and scheduled jobs keep running in the logs.
3. Memory stays under 2 GB for the day and after a restart.
4. Bachs sandbox: a payment and a refund complete, and their webhooks arrive and
   update the order (see `medusa/src/modules/bachs/README.md`).
5. Restart Redis while a job is queued; the job still runs afterwards.
6. Storefront: `/ng`, a product page with images, cart, checkout, and Admin
   product edits revalidating the storefront.
7. The month's bill matches the expected resource pricing.

If any step fails, stay on the Render + Vercel setup for production.

## Releases and rollback

Release the same tested commit to backend first, then storefront. Migrations
must stay backward compatible with the previous release: rolling back a
service does not roll back the database.
