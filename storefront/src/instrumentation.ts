import * as Sentry from "@sentry/nextjs"

export function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  })
}

export const onRequestError = Sentry.captureRequestError
