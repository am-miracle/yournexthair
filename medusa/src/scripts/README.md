# Custom CLI Script

## Development checkout shipping

After seeding the catalog, run `APP_ENV=development pnpm seed:dev-shipping`
from `medusa`, with `DATABASE_URL` pointing to the development database.
This repeatable seed adds a development warehouse, links active sales channels,
and creates country service zones for the existing NGN/USD regions and shipping
profiles. Existing matching options are preserved on subsequent runs.

Delivery is labeled **Test delivery (sample rate)**: NGN 15,000 or USD 10.
These are development fixtures, not real courier prices. The warehouse address
is also a fixture. No product data, inventory quantities, or Terminal settings
are changed. Production checkout requires real warehouse details, delivery
pricing, and (for Terminal) measured parcels and variant dimensions.

## Nigeria VAT

VAT is **off** (0%) because the business is below the VAT registration
threshold. Startup (and `pnpm setup:nigeria-vat`) creates the Nigeria tax
region with a 0% default "VAT" rate if it is missing, and never changes an
existing rate. Checkout hides the VAT line while it is zero.

To start charging VAT once registered, set the rate to 7.5% (Nigeria Tax Act
2025) in Admin → Settings → Tax Regions → Nigeria. No deploy is needed. Prices
are then VAT-exclusive, so VAT is added at checkout; Terminal shipping quotes are
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
import { 
  ExecArgs,
  IProductModuleService
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function myScript ({
  container
}: ExecArgs) {
  const productModuleService: IProductModuleService = 
    container.resolve(Modules.PRODUCT)

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

export default async function myScript ({
  args
}: ExecArgs) {
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
