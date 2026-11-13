# Terminal production integration review

Reviewed 13 November 2026 against Terminal Africa's official documentation. Code
observations describe the integration before the production work in this session.
No Terminal account requests or paid bookings were made for this review.

## Checkout quotes and parcel contracts

- `POST /v1/rates/shipment/quotes` accepts pickup/delivery address objects, a
  parcel, currency, optional carrier ID and `persist_data`. A quote can be used
  for booking only with `persist_data: true`; full address details are then
  required. The current checkout's `persist_data: false` is appropriate for
  browsing but its returned quote cannot simply be reused to book a courier.
  [Quote API](https://docs.terminal.africa/tship/rate/get-quotes-for-shipment)
- Address country uses ISO alpha-2. City, state and country are required; booking
  also needs names, street, phone and postal code. The quote builder maps these
  names correctly, but the original pickup context has no contact email or
  explicit contact names and accepts empty phone/postal code. Production booking
  must obtain the real warehouse contact details.
  [Address API](https://docs.terminal.africa/tship/address/create-address)
- Parcel requests use `packaging` for the packaging identifier and `weight_unit:
  "kg"`. The current shape matches this contract.
  [Parcel API](https://docs.terminal.africa/tship/parcel/create-parcel)
- Item `value` is the total line value; `weight` is in kilograms and quantity is
  separate. Current `unit_price * quantity` and grams divided by 1,000 match
  those definitions. `hs_code` is supported but currently absent.
  [Parcel item](https://docs.terminal.africa/tship/miscallaneous/parcel-item)
- Packaging creation requires box dimensions in centimetres and weight in
  kilograms. The current conversions and `packaging_id` response parsing match.
  [Packaging API](https://docs.terminal.africa/tship/packaging/create-packaging)

## Environment and collection modes

- Terminal documents separate sandbox (`https://sandbox.terminal.africa/v1`)
  and live (`https://api.terminal.africa/v1`) API roots. Original client code
  hardcodes live, including when Admin registers packaging. Both paths need the
  same explicit environment selection.
  [Authentication](https://docs.terminal.africa/tship/authentication)
- Modern rates expose `pickup_options` containing regular pickup, priority
  pickup, scheduled pickup or drop-off. Priority pickup has an additional fare.
  Original rate parsing discards these options and treats an absent legacy
  `dropoff_required` flag as evidence of pickup eligibility. That is insufficient
  when the response explicitly offers only drop-off or a priced priority option.
  [Rate object](https://docs.terminal.africa/tship/rate)
- Offer only returned collection options. Scheduled pickup requires a separate
  schedule step and only supported carriers/lanes qualify. A successful priority
  booking may still contain a rider failure warning and require hub drop-off.
  [Pickup workflow](https://docs.terminal.africa/tship/guides/pickup-workflow)

## Automatic booking flow and duplicate protection

The following is the recommended application flow, inferred from the documented
endpoints. Durable state, locks and uncertainty handling are application design
requirements rather than claims that Terminal provides an idempotency guarantee.

1. Before spending money, persist a booking-attempt record unique to the Medusa
   fulfillment and acquire an exclusive lock. Store request intent durably before
   each external mutation. Validate actual packed contents and warehouse contact
   details, and require a paid order.
2. Create a draft using `POST /v1/shipments/quick`, supplying pickup/delivery
   address objects, parcel, `shipment_purpose: "commercial"` and correlation
   metadata. Persist the returned `data.shipment_id` immediately.
   [Quick shipment](https://docs.terminal.africa/tship/shipment/create-quick-shipment)
3. Fetch `GET /v1/rates/shipment?shipment_id=...&currency=...`. The response's
   `data` is an array of rates, including `rate_id`; select the intended carrier,
   currency and supported pickup option. Compare the fresh amount to the paid
   shipping amount and follow an explicit store policy for increases.
   [Shipment rates](https://docs.terminal.africa/tship/rate/get-rates-for-shipment-1)
4. Persist a booking-requested state, then call `POST /v1/shipments/pickup` with
   both `shipment_id` and `rate_id`, plus the supported `pickup_option`. Omitting
   the shipment ID allows Terminal to create a shipment automatically; the
   integration should retain the known draft identity. Save response shipment
   ID, status, labels/tracking and any pickup warning. The example returns
   tracking in `data.extras`; fields may be absent pending carrier processing.
   [Arrange delivery](https://docs.terminal.africa/tship/shipment/arrange-pickup-and-delivery-for-shipment)
5. After a timeout, malformed success response, process crash or database-write
   failure, mark the result uncertain and retrieve the known shipment before any
   retry. A draft status alone is not proof that an in-flight paid request cannot
   still complete. Do not automatically issue a second paid request while the
   first outcome is uncertain.
   [Get shipment](https://docs.terminal.africa/tship/shipment/get-shipment)

No reviewed endpoint advertises an idempotency header or client-supplied unique
booking reference. Creating a draft also has a possible unknown outcome if its
response is lost. The integration must not claim exactly-once booking merely
because it supplies metadata or uses a short-lived lock. `GET /v2/shipments`
supports text search over tracking number, shipment ID and shipment reference,
not arbitrary metadata; do not use metadata search as an assumed recovery API.
[Shipment search](https://docs.terminal.africa/tship/shipment/get-shipments-1)

Before carrier pickup, cancellation is `POST /v1/shipments/cancel` with
`shipment_id`. Preserve uncertain cancellation state on transport failure;
Medusa cancellation must not claim the courier was cancelled without confirming
the upstream result. [Cancellation](https://docs.terminal.africa/tship/shipment/cancel-shipment)

The original provider does none of this: `createFulfillment` only returns
`booking_required: true`, and cancellation returns an empty object. Those are
manual operations semantics, not automatic fulfillment.

## Webhooks and tracking

Create an HTTPS webhook subscription with the appropriate `live` boolean and
event list. Updating a subscription replaces its events array, so preserve
existing subscriptions. [Webhook setup](https://docs.terminal.africa/tship/webhooks/create-webhook)

Validate `X-Terminal-Signature` as a 128-character hex HMAC-SHA512 over the exact
raw request bytes using the Terminal secret, with constant-time comparison.
Commit a durable inbox record before returning success. For pickup events,
deduplicate `event_id` and atomically apply only increasing `data.version` per
pickup ID. Other resource events have their own envelopes; do not assume all
shipment events include pickup identity/version fields.
[Webhook handling](https://docs.terminal.africa/tship/miscallaneous/webhook-events/handling-webhook-events)

Persist Terminal shipment ID as the stable identity. Tracking numbers and labels
can be replaced; the tracking endpoint accepts the Terminal shipment ID, current
tracking number or replaced tracking number. Use updated labels after a waybill
correction. [Tracking](https://docs.terminal.africa/tship/shipment/track-a-shipment)

## Launch data and unresolved facts

- Real origin address/contact, supported lanes, registered packaging, measured
  packed variant dimensions/weights, live credentials, funded wallet and store
  policy for quote changes are needed. Sample dev rates and fixture addresses
  cannot verify any of those account-specific facts.
- The parcel documentation announces mandatory item manufacturer profiles for
  goods sent to the EU from **20 November 2026**. Original code sends none. Obtain
  real manufacturer profiles before enabling those lanes; do not fabricate them.
  [EU parcel requirement](https://docs.terminal.africa/tship/parcel/create-parcel)
- The reviewed amount schemas identify currency and numeric values, but do not
  explicitly guarantee minor-versus-major units or inclusive tax treatment.
  Existing code passes rate amounts straight into Medusa and declares them tax
  inclusive. Confirm both against sandbox/account responses and the store's tax
  policy before accepting live payments. Never infer a conversion from a single
  example amount. [Rate fields](https://docs.terminal.africa/tship/rate)
- Carrier examples and successful mock tests do not prove account-level enabled
  carriers, route eligibility, live prices, label availability timing, or paid
  booking behavior. Finish with sandbox integration tests followed by a controlled
  live transaction approved by the store operator.

