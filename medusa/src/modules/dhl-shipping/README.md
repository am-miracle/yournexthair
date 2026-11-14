# DHL Express shipping

This provider replaces Terminal Africa with the direct MyDHL REST API. Official
API reference: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
Research and request contracts: ../../../../docs/dhl-api-research.md

## Credentials and deployment

Configure backend-only `DHL_API_USERNAME`, `DHL_API_PASSWORD` and
`DHL_ACCOUNT_NUMBER`. These are MyDHL API credentials, not the MyDHL+ website login.
An existing verified DHL business must obtain API access for its shipping account.
Never put credentials in storefront variables or commit them.

`DHL_ENVIRONMENT=sandbox` (default) uses `https://express.api.dhl.com/mydhlapi/test`.
`live` uses `https://express.api.dhl.com/mydhlapi`. No custom host is accepted.
Absent credentials leave manual delivery and pickup available.

Run `pnpm exec medusa db:migrate` to create the new `dhl_booking` ledger. Run a
worker or shared mode for event subscribers and the five-minute reconciliation job.
Keep `DHL_AUTO_BOOKING=false` until sandbox acceptance passes, then set it to true
on the backend and worker. This flag controls booking, not checkout quotes.

## Replace existing shipping options

Old Terminal options and historical bookings are not converted or deleted. Before
removing the old integration from a live deployment, reconcile any pending Terminal
shipments in Terminal and preserve old booking records. Fulfill existing Terminal
orders manually with their original courier; do not purchase replacement DHL labels
for an already booked shipment. Existing carts must select a fresh DHL option.

1. Under Settings → Locations & Shipping, enter the actual dispatch address,
   country, city, state, postcode and phone. This implementation plans pickups
   from Nigeria on the next weekday at 10:00 local time, with a 17:00 close time.
   Confirm the business can meet this schedule and DHL supports that date (public
   holidays are not inferred). A failed booking needs staff attention.
2. Enable DHL at the stock location and link the storefront sales channel.
   Add calculated shipping options using **Live courier delivery** in the approved
   destination service zones, matching the products' shipping profiles.
3. Open **DHL shipping** in Admin. Save the dispatch contact, measured box weight
   and outer dimensions, and tested capacity. No remote packaging registration is
   needed. Optionally restrict the global DHL product code. Otherwise the cheapest
   available standard product in the cart currency is selected.
4. Set every variant's measured weight in grams and folded dimensions in cm.
   For international goods set `variant.metadata.hs_code` (6–10 digits) and
   `variant.metadata.country_of_origin` (actual two-letter manufacturing country).
   Manufacturing country must not be inferred from the dispatch country. Terminal
   manufacturer profile IDs are no longer used. Destination-specific legal product
   information remains the business's responsibility.
5. Disable the old Terminal shipping options in Admin before reopening checkout.
   Keep manual delivery/pickup as desired. No database updates happen just by
   changing the provider configuration.

For repeatable setup run `pnpm setup:dhl-shipping /absolute/path/shipping.json`.
Required fields: `stock_location_id`, `sales_channel_ids`, `shipping_profile_ids`,
`countries` (lowercase ISO codes), and `package`:

```json
{
  "name": "Measured dispatch box",
  "pickup_first_name": "Dispatch contact first name",
  "pickup_last_name": "Dispatch contact last name",
  "pickup_email": "dispatch@example.com",
  "weight_grams": 100,
  "length_cm": 30,
  "width_cm": 25,
  "height_cm": 10,
  "max_items": 3,
  "max_content_weight_grams": 2000,
  "product_code": ""
}
```

The measurements above are illustrative, not production defaults. Use actual
measurements and packing tests. Setup validates resources and variant measurements,
creates DHL service zones/options, and never buys a shipment. Reruns preserve matching
options; use Admin to review changes. Switching sandbox/live requires saving package
settings again and reviewing the enabled options.

## Checkout and operations

Quotes use `POST /rates`; they never create shipments. Total parcel weight includes
empty packaging and all quantities. Oversized and partially configured orders fail
explicitly. Shipping prices are main currency units and treated as tax inclusive;
confirm tax treatment against your DHL account invoices. Only totals in the exact
cart currency are offered. No implicit exchange rate is used. If DHL only quotes
NGN for your account, USD checkout needs a separate manual option until an explicit
currency conversion policy is implemented. API failures never become free shipping.

Creating a complete fulfillment for a fully captured, unrefunded order triggers a
fresh rate for the selected global/local product. An increase above the amount paid
requires review; customers are never charged automatically. One fulfillment books
one tested box. Split shipments and automatic returns are unsupported.

`POST /shipments` creates the waybill and requests pickup. The fulfillment ID is
sent as a `CU` customer reference. The booking ledger uses a unique fulfillment key
and an atomic transition before creation. A timeout or ambiguous failure leaves the
booking in `creating`; automatic workers NEVER repeat creation. Locate the waybill
in DHL by its fulfillment reference, then associate it in **DHL bookings**. Tracking
must return the matching reference before association. If tracking is not yet
available, contact DHL and wait; do not reset/delete the ledger or buy another label.

Waybill/tracking links are saved to Medusa. Base64 PDF labels and commercial invoices
are stored in the private booking result and downloaded through authenticated Admin
routes. Public order data does not include label documents. Recovered waybills may
need document retrieval through DHL directly.

International shipments use DAP: destination duties and taxes are the recipient's
responsibility. Insurance, landed-cost collection and duty prepayment are not
implemented. Return delivery is manual.

DHL's API cancels **pickups**, not waybills. Cancelling a Medusa fulfillment with an
existing DHL waybill records an operator error; staff must contact DHL to resolve
pickup cancellation and charges. This integration does not claim to cancel a DHL
shipment or automatically create a replacement. The pickup confirmation is retained
in the booking result. Reconciliation polls tracking for booked waybills; absence
of tracking before collection never authorizes a second purchase.

## Acceptance before live use

Run unit tests, then use real sandbox credentials to check: domestic and approved
international quotes, unsupported addresses, oversized carts, exact checkout
currency/amount/tax treatment, paid full fulfillment, label/invoice downloads,
tracking, unavailable pickup dates, price increases, replay and ambiguous-request
reconciliation. Confirm destination-specific customs requirements and account
service eligibility. Then configure live credentials, save live packages, disable
old Terminal options, test live quotes and enable automatic booking. Mock tests do
not establish account eligibility or courier performance.
