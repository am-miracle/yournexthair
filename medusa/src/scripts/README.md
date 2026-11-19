# Custom CLI Script

## Development checkout shipping

After seeding the catalog, run `APP_ENV=development pnpm seed:dev-shipping`
from `medusa`, with `DATABASE_URL` pointing to the development database.
This repeatable seed adds a development warehouse, links active sales channels,
and creates country service zones for the existing NGN/USD regions and shipping
profiles. Existing matching options are preserved on subsequent runs.

Delivery is labeled **Test delivery (sample rate)**: NGN 15,000 or USD 10.
These are development fixtures, not real courier prices. The warehouse address
is also a fixture. No product data, inventory quantities, or DHL settings
are changed. Production checkout requires real warehouse details, delivery
pricing, and (for DHL) measured parcels and variant dimensions.

## Nigeria VAT

VAT is **off** (0%) because the business is below the VAT registration
threshold. Startup (and `pnpm setup:nigeria-vat`) creates the Nigeria tax
region with a 0% default "VAT" rate if it is missing, and never changes an
existing rate. Checkout hides the VAT line while it is zero.

To start charging VAT once registered, set the rate to 7.5% (Nigeria Tax Act 2025) in Admin → Settings → Tax Regions → Nigeria. No deploy is needed. Prices
are then VAT-exclusive, so VAT is added at checkout; DHL shipping quotes are
treated as VAT-inclusive. International carts have no tax rate.

## International shipping

`pnpm setup:international-shipping 40 [stock_location_id]` creates a flat
**International delivery** option (USD 40 per order) for every country in the
USD region. Orders are booked by hand with the courier. The checkout tells
non-Nigerian customers that import duties are paid on delivery. Reruns keep the
existing option; change its price in Admin.

A custom CLI script is a function to execute through Medusa's CLI tool. This is useful when creating custom Medusa tooling to run as a CLI tool.

## How to Create a Custom CLI Script?

To create a custom CLI script, create a TypeScript or JavaScript file under the `src/scripts` directory. The file must default export a function.

For example, create the file `src/scripts/my-script.ts` with the following content:

```ts title="src/scripts/my-script.ts"
import { ExecArgs, IProductModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function myScript({ container }: ExecArgs) {
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT)

  const [, count] = await productModuleService.listAndCount()

  console.log(`You have ${count} product(s)`)
}
```

The function receives as a parameter an object having a `container` property, which is an instance of the Medusa Container. Use it to resolve resources in your Medusa application.

---

## How to Run Custom CLI Script?

To run the custom CLI script, run the `exec` command:

```bash
npx medusa exec ./src/scripts/my-script.ts
```

---

## Custom CLI Script Arguments

Your script can accept arguments from the command line. Arguments are passed to the function's object parameter in the `args` property.

For example:

```ts
import { ExecArgs } from "@medusajs/framework/types"

export default async function myScript({ args }: ExecArgs) {
  console.log(`The arguments you passed: ${args}`)
}
```

Then, pass the arguments in the `exec` command after the file path:

```bash
npx medusa exec ./src/scripts/my-script.ts arg1 arg2
```

## Seed the local storefront catalog

From `medusa`, run `pnpm seed:catalog`. This ensures regions, categories,
collections, product types, a default shipping profile and sales channel, then
creates five published demo products with two length variants and NGN/USD prices.
Existing products with the same handles are preserved. Existing publishable keys
are linked to the default sales channel so the storefront can see the catalog.

Images reference `storefront/public/images/content` through `STOREFRONT_URL`
(default `http://localhost:8000`); keep the storefront running to serve them.
Collection images use stable public-asset identifiers rather than uploaded files.
All prices and hair specifications are illustrative and should be reviewed in
Admin before using this catalog for real orders. Inventory tracking is disabled
for these demo variants. This seed does not create shipping rates or stock locations.

Run `pnpm exec medusa exec ./src/scripts/index-products.ts` to refresh search.

## Configure delivery from Nigeria

Use an NGN Nigeria region and a USD international region. Checkout reprices the
cart when the delivery country changes. Verify product prices and payment
provider currency support.

Configure `FEZ_API_USERNAME` and `FEZ_API_PASSWORD` using FEZ Business account
credentials. Configure `GIG_API_USERNAME`, `GIG_API_PASSWORD`, and
`GEOAPIFY_API_KEY` for GIG rates and pickup. Geoapify receives the dispatch and
destination street addresses for geocoding. GIG is offered when the address
resolves to a Nigerian street, building or amenity result and GIG returns a quote.
Quote failures are logged with the carrier's reason.

Checkout quotes (10 minutes per identical rate request) and Geoapify coordinates
(30 days per address) are cached in Medusa's caching module (Redis), falling back
to process memory without it. Keys are hashed, so addresses aren't stored in key
names. Carrier login tokens are kept only in process memory for 10 minutes and
renewed early if the carrier rejects one; they are never written to Redis.
Dispatch always fetches a fresh price before purchasing.
Set `FEZ_ENVIRONMENT` and `GIG_ENVIRONMENT` to `sandbox` for testing or `live` for
production. Verify the merchant accounts can purchase shipments.

From `medusa`, run `pnpm setup:nigeria-shipping /absolute/path/nigeria-shipping.json`.
For example, the following describes partial coverage and illustrative package
measurements. Use your actual dispatch address, measured packing data and
confirmed routes. Set measured variant weights in grams; the script lists any
published variant in the configured shipping profiles that has no weight.

```json
{
  "stock_location_id": "sloc_...",
  "sales_channel_ids": ["sc_..."],
  "shipping_profile_ids": ["sp_..."],
  "parcel": {
    "sender_name": "YourNextHair Dispatch",
    "box_weight_grams": 100,
    "length_cm": 30,
    "width_cm": 25,
    "height_cm": 10,
    "max_weight_kg": 2
  },
  "zones": [
    { "name": "Lagos", "provinces": ["lagos"], "carriers": ["fez", "gig"] },
    { "name": "Interstate", "provinces": ["fct", "rivers"], "carriers": ["fez", "gig"] }
  ]
}
```

Add all states you intend to serve, using lowercase names such as `akwa ibom` or
`fct` for the Federal Capital Territory. The script creates separate live-priced
FEZ and GIG options for eligible zones and profiles. Review and disable any
overlapping legacy options in Medusa Admin, including manual shipping and
sandbox options before enabling live checkout. The storefront also hides options
of type `nigeria-delivery` so the old flat-rate option can't be selected next to
the live carriers. Preserve historical bookings. To change the parcel or move
existing options from sandbox to live, update the JSON and environment variables
and run the script again; it updates the saved options in place.

Run `pnpm exec medusa db:migrate` and run Medusa in worker or shared mode. The
order-placed subscriber queues the order in `courier_dispatch`. The worker waits
for full payment capture, creates the fulfillment, purchases the selected
carrier's waybill, and attaches tracking to the order. Orders awaiting capture
are re-checked every 15 minutes. Errors are retried with backoff (up to an hour
apart) and the row moves to `failed` after 6 attempts; `last_error` records why.
These go straight to `failed` for manual review without purchasing: a refunded
order, a current quote above the paid shipping amount, a fulfillment that doesn't
match the selected courier, or a cancelled fulfillment. A request with an
ambiguous purchase outcome remains in state `creating`, with no duplicate
purchase. Reconcile with the carrier using the order ID, which FEZ stores as the
unique ID and GIG receives in the shipment item description, before any
operational action. GIG tracking links open GIG's public tracking page with the
waybill filled in. Cancelling a fulfillment in
Medusa does not cancel the carrier waybill; cancel it with the carrier.

Set up [DHL](../modules/dhl-shipping/README.md) for Nigeria (include `ng` in
its `countries`, so DHL is offered next to FEZ and GIG) and approved USD destinations,
and enable `DHL_AUTO_BOOKING=true` after acceptance testing. Until then DHL
orders wait in the queue and are re-checked every 15 minutes. The same queue
creates DHL fulfillments once fully paid. Creating the fulfillment also triggers
the existing DHL booking subscriber; both paths go through the DHL booking
ledger, which purchases the waybill once. Test both domestic carriers and DHL end to end in sandbox
before enabling the corresponding live options.

Carrier contracts were cross-checked against the carrier-maintained
[FEZ plugin](https://wordpress.com/plugins/fez-delivery) and
[GIG plugin](https://wordpress.org/plugins/gig-logistics-delivery/).
