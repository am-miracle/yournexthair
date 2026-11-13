# Terminal Africa shipping

Live delivery quotes use the configured stock location as the origin, each cart
variant's physical shipping attributes, and a package registered with Terminal.
API reference: https://docs.terminal.africa/tship/rate/get-quotes-for-shipment

## Developer setup

Set `TERMINAL_SECRET_KEY` and `TERMINAL_ENVIRONMENT=sandbox` on the backend and restart Medusa. Keep the key out of
storefront environment variables. Without a key the provider is not registered;
manual shipping and pickup continue to work. No Terminal API key is bundled with
this repository. Real account quotes require the client's Terminal account.

Terminal documents separate [sandbox and live API hosts](https://docs.terminal.africa/tship/authentication).
The client defaults to sandbox. Set `TERMINAL_ENVIRONMENT=live` explicitly for
production, then save packaging again: sandbox packaging IDs cannot be reused
in live. Existing packages without environment/contact information must also be
saved again in Admin after upgrading.

Run `pnpm exec medusa db:migrate` during deployment to create the durable
`terminal_booking` ledger. Run Medusa in `shared` mode or provide a worker:
automatic booking depends on event subscribers and a five-minute reconciliation
job. Keep `TERMINAL_AUTO_BOOKING=false` until account acceptance testing passes.

## Client setup in Admin

1. Under Settings → Locations & Shipping, create or select the dispatch location.
   Enter the actual Port Harcourt street address, city, Rivers state, country,
   phone, and postal code. Link the location to the storefront sales channel and
   enable its Terminal fulfillment provider.
2. Enable shipping, create a service zone for the destinations you support, and
   add a **calculated** shipping option using **Live courier delivery**. Use the
   same shipping profile as the products. Name the option “Courier delivery”.
   Keep any free pickup option separate and fixed-price.
3. Open **Terminal shipping** in the Admin sidebar. Select the shipping option
   and enter the dispatch contact's first name, last name and email, the real box dimensions, empty packaging weight, maximum item count,
   and maximum contents weight. Saving registers the box with Terminal. Optionally
   enter a carrier reference from your Terminal account to restrict the service.
4. For every product variant, enter **weight in grams** and folded/packed item
   **length, width, height in centimetres**. Medusa does not inherit these values
   from the product. Hair length in inches is a separate hair metadata field.
5. Test local, interstate, unsupported-address and oversized carts before launch.
   The demo catalog deliberately has no invented physical weights: the client must
   supply measurements. Ensure the selected delivery charge appears in payment.

For repeatable setup against an existing real warehouse, run
`pnpm setup:terminal-shipping /absolute/path/to/shipping.json`. The JSON fields
are `stock_location_id`, `sales_channel_ids` (array), `shipping_profile_ids`
(array), `countries` (array of approved lowercase ISO country codes), and
`package` (the settings described below). The package must contain `name`,
`pickup_first_name`, `pickup_last_name`, `pickup_email`, `weight_grams`,
`length_cm`, `width_cm`, `height_cm`, `max_items`,
`max_content_weight_grams`, and optional `carrier_reference`.
Use measured values. The command checks warehouse details and published variant
measurements, links the selected sales channels/provider, registers packaging,
and creates calculated options for the selected countries and profiles. Reruns
preserve matching options; changed settings require review in Admin. It creates
no demo products, flat-rate shipping, inventory quantities or paid shipments.

A box must have a tested capacity. The provider rejects missing physical values,
items that do not fit individually, excess volume, excess weight, or excess item
count. These checks are not a 3D packing optimizer; set conservative capacities
based on actual packed orders. Orders larger than a single configured package
need a manual quote or a separate shipping option with a larger tested box.

## Checkout and fulfillment

The storefront explicitly calculates each calculated shipping option through
`POST /store/custom/shipping-options/:id/calculate`. This uses the same
eligibility and pricing workflow as cart shipping selection, including the cart
currency (omitted by Medusa 2.15’s standalone calculation workflow). A failed
quote is never displayed as zero. Working manual shipping/pickup options remain
available if one courier option fails. Rates are in the cart currency, in main
currency units, and treated as tax-inclusive totals. The cheapest matching pickup
rate is selected; drop-off-only services and other currencies are excluded.
The provider caches a quote for at most one minute, keyed by the full parcel and
addresses. Customer-supplied prices and quote payloads are ignored. Medusa
recalculates the shipping price when the shipping method/cart is refreshed.

Quotes use `persist_data: false`: browsing and selecting delivery do not purchase
shipping or create booked shipments. A snapshot of the quoted courier, amount,
currency, and delivery estimate is stored with the shipping method.

With `TERMINAL_AUTO_BOOKING=true`, creating an order fulfillment automatically
books its courier **after full payment capture**. Staff must pack the complete
order first. Partial fulfillment is rejected because one shipping charge and one
tested package cannot fund multiple shipments. Refunded/unpaid orders are not
booked. The subscriber creates a draft with order/fulfillment metadata, saves its
ID, obtains fresh rates for the originally selected carrier and currency, and
books regular pickup. A price above the amount paid requires operator review;
the customer is never charged extra automatically. See Terminal's
[booking endpoint](https://docs.terminal.africa/tship/shipment/arrange-pickup-and-delivery-for-shipment).

Each irreversible request is preceded by a durable state transition unique to
the fulfillment. After a timeout, workers retrieve the saved shipment and do not
purchase another. A lost draft-creation response requires a staff member to find
the shipment in Terminal and enter its ID under **Terminal bookings**; its order
and fulfillment metadata are verified before association. A draft response after
an uncertain paid request does not authorize a second purchase. There is no
documented upstream idempotency key, so uncertain attempts require reconciliation.
Never delete or reset ledger rows to retry a purchase.

Tracking numbers/URLs and available labels are copied to the fulfillment. The
five-minute job polls Terminal for updates and retries safe pending work; no
webhook subscription is needed for this polling implementation. Booking failures,
rate increases and uncertain outcomes are visible under **Terminal bookings**.
Medusa fulfillment cancellation requests cancellation of the same Terminal
shipment and confirms its remote status. Cancellation can be refused after
carrier collection; inspect the booking error and resolve it with Terminal.
Return shipping is handled manually.

Only regular pickup is supported. Explicit dropoff-only, scheduled-only and
priority-only rates are excluded; priority collection fees are not silently
omitted. International variants need a customs HS code in `variant.metadata.hs_code`.
EU goods also require `variant.metadata.manufacturers_profile` containing the
real Terminal manufacturer address ID. Terminal's
[parcel documentation](https://docs.terminal.africa/tship/parcel/create-parcel)
announces that manufacturer requirement from 20 November 2026; this integration
requires it before quoting EU goods already. No customs-duty payment or shipment
insurance automation is provided. Enable only lanes that the business has tested.

## Production acceptance

Before enabling live automatic booking, verify against the client's sandbox:
local and interstate quotes, invalid addresses and oversized orders; the amount
charged at checkout; a paid complete fulfillment returning a shipment ID,
tracking and label; replay without another purchase; insufficient wallet balance;
price increase; cancellation; and operator reconciliation. Confirm Terminal's
amount scale and the store's tax-inclusive shipping policy with real account
responses. Unit fixtures do not establish these account-level facts.

Then configure the live key, select `live`, re-register real packaging, fund the
Terminal wallet, and enable `TERMINAL_AUTO_BOOKING=true` on the worker. The dev
flat-rate seed is unrelated to production Terminal setup. Do not expose its sample
options on a live store. Research and remaining account questions are recorded
in [PRODUCTION-REVIEW.md](./PRODUCTION-REVIEW.md).

## Verification

`pnpm test:unit` covers unit conversion, quantities, missing/oversized items,
address changes, cache expiry, rate filtering, price tampering, and API failures.
The storefront tests cover calculated rates and partial/all-provider failures.
Booking tests cover captured/refunded payments, complete/partial fulfillments,
same-shipment retries, ambiguous draft creation, cancellation, price increases,
environment isolation and tracking persistence. These tests mock Terminal; a
sandbox acceptance run and live configuration remain necessary.
