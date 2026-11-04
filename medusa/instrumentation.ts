import * as Sentry from "@sentry/node"

// Better Stack ingests Sentry SDK events; SENTRY_DSN is the Better Stack application DSN.
export function register() {
  if (!process.env.SENTRY_DSN) {
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
  })
}
