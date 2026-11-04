# Terminal Africa shipping

Live delivery quotes use the configured stock location as the origin, each cart
variant's physical shipping attributes, and a package registered with Terminal.
API reference: https://docs.terminal.africa/tship/rate/get-quotes-for-shipment

## Developer setup

Set `TERMINAL_SECRET_KEY` on the backend and restart Medusa. Keep the key out of
storefront environment variables. Without a key the provider is not registered;
manual shipping and pickup continue to work. No Terminal API key is bundled with
this repository. Real account quotes require the client's Terminal account.

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
   and enter the real box dimensions, empty packaging weight, maximum item count,
   and maximum contents weight. Saving registers the box with Terminal. Optionally
   enter a carrier reference from your Terminal account to restrict the service.
4. For every product variant, enter **weight in grams** and folded/packed item
   **length, width, height in centimetres**. Medusa does not inherit these values
   from the product. Hair length in inches is a separate hair metadata field.
5. Test local, interstate, unsupported-address and oversized carts before launch.
   The demo catalog deliberately has no invented physical weights: the client must
   supply measurements. Ensure the selected delivery charge appears in payment.

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
currency, and delivery estimate is stored with the shipping method. Fulfillment
marks `booking_required: true` and does **not** book a courier. Book the shipment
in Terminal when the order is packed, then enter tracking information in Medusa.
Cancellation in Medusa does not cancel an externally booked shipment; cancel it
in Terminal too. Return shipping is handled manually.

No customs duties, shipment insurance, automatic pickup booking, or carrier
tracking webhooks are added by this integration. Enable international zones only
after testing the client's lanes and deciding how to handle customs and insurance.

## Verification

`pnpm test:unit` covers unit conversion, quantities, missing/oversized items,
address changes, cache expiry, rate filtering, price tampering, and API failures.
The storefront tests cover calculated rates and partial/all-provider failures.
