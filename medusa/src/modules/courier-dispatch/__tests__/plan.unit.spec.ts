import { BigNumber } from "@medusajs/framework/utils"
import { type DispatchOrder, orderSchema, planDispatch, retryDelayMinutes } from "../plan"

const fez = { id: "so_fez", provider_id: "nigeria_fez" }
const dhl = { id: "so_dhl", provider_id: "dhl_dhl" }
const order = (overrides: Partial<DispatchOrder> = {}): DispatchOrder => ({
  id: "order_1",
  status: "pending",
  currency_code: "ngn",
  email: "ada@example.com",
  items: [{ id: "item_1", quantity: 2, unit_price: 5000, requires_shipping: true, variant: null }],
  shipping_methods: [{ shipping_option_id: "so_fez", amount: 4000 }],
  fulfillments: [],
  payment_collections: [
    { status: "completed", amount: 14000, captured_amount: 14000, refunded_amount: 0 },
  ],
  ...overrides,
})
const settings = { dhlAutoBooking: true }

it("fulfils a fully paid courier order with every shippable item", () => {
  expect(planDispatch(order(), fez, settings)).toEqual({
    action: "fulfill",
    courier: { kind: "nigeria", carrier: "fez" },
    option: fez,
    items: [{ id: "item_1", quantity: 2 }],
    fulfillmentId: undefined,
    shippingAmount: 4000,
  })
})

it("reuses the active fulfillment for the selected courier", () => {
  const plan = planDispatch(
    order({ fulfillments: [{ id: "ful_1", shipping_option_id: "so_fez", canceled_at: null }] }),
    fez,
    settings,
  )
  expect(plan).toMatchObject({ action: "fulfill", fulfillmentId: "ful_1" })
})

it.each([
  ["a canceled order", order({ status: "canceled" }), fez],
  ["a non-courier option", order(), { id: "so_manual", provider_id: "manual_manual" }],
  ["a missing option", order(), undefined],
  [
    "an order with nothing to ship",
    order({
      items: [
        { id: "item_1", quantity: 1, unit_price: 1, requires_shipping: false, variant: null },
      ],
    }),
    fez,
  ],
])("skips %s", (_label, input, option) => {
  expect(planDispatch(input, option, settings)).toEqual({ action: "skip" })
})

it.each([
  [
    "partial capture",
    order({
      payment_collections: [
        { status: "completed", amount: 14000, captured_amount: 7000, refunded_amount: 0 },
      ],
    }),
  ],
  [
    "an authorized payment",
    order({
      payment_collections: [
        { status: "authorized", amount: 14000, captured_amount: 0, refunded_amount: 0 },
      ],
    }),
  ],
  ["no payment", order({ payment_collections: [] })],
])("holds an order with %s", (_label, input) => {
  expect(planDispatch(input, fez, settings)).toMatchObject({ action: "hold" })
})

it("holds DHL orders until automatic booking is enabled", () => {
  const input = order({ shipping_methods: [{ shipping_option_id: "so_dhl", amount: 30 }] })
  expect(planDispatch(input, dhl, { dhlAutoBooking: false })).toMatchObject({ action: "hold" })
  expect(planDispatch(input, dhl, settings)).toMatchObject({
    action: "fulfill",
    courier: { kind: "dhl" },
  })
})

it.each([
  [
    "a refund",
    order({
      payment_collections: [
        { status: "completed", amount: 14000, captured_amount: 14000, refunded_amount: 1 },
      ],
    }),
  ],
  [
    "several shipping methods",
    order({
      shipping_methods: [
        { shipping_option_id: "so_fez", amount: 4000 },
        { shipping_option_id: "so_fez", amount: 4000 },
      ],
    }),
  ],
  [
    "a fulfillment for another option",
    order({ fulfillments: [{ id: "ful_1", shipping_option_id: "so_other", canceled_at: null }] }),
  ],
  [
    "only canceled fulfillments",
    order({
      fulfillments: [{ id: "ful_1", shipping_option_id: "so_fez", canceled_at: "2026-11-18" }],
    }),
  ],
])("sends an order with %s to manual review", (_label, input) => {
  expect(planDispatch(input, fez, settings)).toMatchObject({ action: "fail" })
})

it("backs off exponentially up to an hour", () => {
  expect([1, 2, 3, 5, 6, 10].map(retryDelayMinutes)).toEqual([2, 4, 8, 32, 60, 60])
})

it("reads Medusa BigNumber quantities and amounts from the order query", () => {
  const parsed = orderSchema.parse({
    ...order(),
    items: [
      {
        id: "item_1",
        quantity: new BigNumber(2),
        unit_price: { value: "5000", precision: 20 },
        requires_shipping: true,
        variant: null,
      },
    ],
    payment_collections: [
      {
        status: "completed",
        amount: new BigNumber(14000),
        captured_amount: new BigNumber(14000),
        refunded_amount: null,
      },
    ],
  })
  expect(parsed.items[0]).toMatchObject({ quantity: 2, unit_price: 5000 })
  expect(parsed.payment_collections[0]).toMatchObject({
    captured_amount: 14000,
    refunded_amount: 0,
  })
  expect(planDispatch(parsed, fez, { dhlAutoBooking: false })).toMatchObject({
    action: "fulfill",
    items: [{ id: "item_1", quantity: 2 }],
  })
})
