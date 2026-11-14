# Bachs payments

Set backend-only `BACHS_SECRET_KEY` and `BACHS_WEBHOOK_SECRET`, then redeploy.
Use sandbox credentials for testing and separate live credentials for launch.
Enable `pp_bachs_bachs` on the appropriate Medusa regions.

## API key permissions

- Payments: Read and Write (checkout creation and payment verification).
- Refunds: Read and Write (request refunds and verify their final outcome).
- All other scopes: No Access. Full Access: Off.

Refunds Read is required by the outcome handler, in addition to the earlier Write permission.
Webhook API permissions are unnecessary when destinations are managed in the dashboard.

## Webhook destination

Choose **Account events** and set the destination to:
`<public-backend-origin>/hooks/payment/bachs_bachs`.

Subscribe to these events:

- Checkout Completed (`checkout.completed`)
- Collection Succeeded (`collection.succeeded`)
- Collection Failed (`collection.failed`)
- Collection Underpaid (`collection.underpaid`)
- Checkout Expired (`checkout.expired`)
- Refund Created (`refund.created`)
- Refund Paid (`refund.paid`)
- Refund Failed (`refund.failed`)

Copy that destination's signing secret into `BACHS_WEBHOOK_SECRET`.
The standard Medusa route queues events; HTTP 200 means accepted for processing,
not that a payment was marked paid. Processing failures retry through the event bus
and are reported to Sentry when configured.

Successful payments use Medusa's payment workflow. The additional subscriber verifies
signatures against the raw body, re-fetches Bachs state and checks provider, checkout,
amount and currency against the stored session. It records failed payments as error,
underpaid as requires-more, and expired checkouts as canceled. A paid session is never
downgraded by a late failure event. Underpaid checkouts never authorize fulfillment.

Refund settlement is stored separately in payment-session metadata (`bachs_refunds`, keyed by refund ID)
and shown in **Bachs payment updates** on the Admin order page. The widget refreshes
while open. Medusa records a refund at request time; this handler does not create a
second refund or change financial totals. A Bachs success means funds were sent to
the customer's payment provider; it does not guarantee they are already visible in
the customer's account. Failed refunds are flagged for manual review in Admin and logs;
no automatic retry sends money. Refunds initiated in the Bachs dashboard are tracked
but do not automatically create a Medusa accounting record: reconcile those manually.

Before launch, test success, failure, underpayment, expiry, refund processing/success/failure,
duplicate delivery, delayed delivery and transient API failures in the sandbox.

References:

- https://docs.bachs.io/developer-portal/api-keys
- https://docs.bachs.io/guides/webhooks/overview
- https://docs.bachs.io/guides/refunds
