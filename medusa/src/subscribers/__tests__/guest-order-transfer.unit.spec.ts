import type { SubscriberArgs } from "@medusajs/medusa"
import { requestOrderTransferWorkflow } from "@medusajs/medusa/core-flows"
import handler from "../guest-order-transfer"

jest.mock("@medusajs/medusa/core-flows", () => ({ requestOrderTransferWorkflow: jest.fn() }))

type Order = {
  id: string
  display_id: number
  email: string
  status: string
  created_at: string
  currency_code: string
  total: number
  customer: { id: string; has_account: boolean } | null
  shipping_address: { country_code: string } | null
}

const order = (id: string, overrides: Partial<Order> = {}): Order => ({
  id,
  display_id: Number(id.replace(/\D/g, "")) || 1,
  email: "Ada@Example.com",
  status: "pending",
  created_at: "2026-11-01T10:00:00.000Z",
  currency_code: "ngn",
  total: 50000,
  customer: { id: "cus_guest", has_account: false },
  shipping_address: { country_code: "ng" },
  ...overrides,
})

const oldEnv = { ...process.env }

function setup({ customer, orders, failOn = [] }: { customer: Record<string, unknown> | undefined; orders: Order[]; failOn?: string[] }) {
  const requested: string[] = []
  const run = jest.fn(({ input }: { input: { order_id: string } }) => {
    if (failOn.includes(input.order_id)) return Promise.reject(new Error("Order has an active order change"))
    requested.push(input.order_id)
    return Promise.resolve({ result: {} })
  })
  jest.mocked(requestOrderTransferWorkflow).mockReturnValue({ run } as unknown as ReturnType<typeof requestOrderTransferWorkflow>)

  const graph = jest.fn(({ entity, filters }: { entity: string; filters: Record<string, unknown> }) => {
    if (entity === "customer") return Promise.resolve({ data: customer ? [customer] : [] })
    if (entity === "order") return Promise.resolve({ data: orders })
    const ids = filters.order_id as string[]
    return Promise.resolve({
      data: requested.filter((id) => ids.includes(id)).map((id) => ({
        order_id: id,
        actions: [{ action: "TRANSFER_CUSTOMER", reference_id: "cus_new", details: { token: `tok-${id}` } }],
      })),
    })
  })
  const createNotifications = jest.fn()
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const services: Record<string, unknown> = { query: { graph }, notification: { createNotifications }, logger }
  const args = { event: { data: { id: "cus_new" } }, container: { resolve: (key: string) => services[key] } } as unknown as SubscriberArgs<{ id: string }>
  return { args, run, graph, createNotifications, logger }
}

const registered = { id: "cus_new", email: "ada@example.com", first_name: "Ada", has_account: true }

beforeEach(() => {
  process.env.STOREFRONT_URL = "https://shop.example.com/"
})
afterEach(() => {
  process.env = { ...oldEnv }
  jest.resetAllMocks()
})

it("ignores customers without an account", async () => {
  const { args, run, createNotifications } = setup({ customer: { ...registered, has_account: false }, orders: [order("order_1")] })
  await handler(args)
  expect(run).not.toHaveBeenCalled()
  expect(createNotifications).not.toHaveBeenCalled()
})

it("requests transfers for matching guest orders and sends one email with every token", async () => {
  const { args, run, graph, createNotifications } = setup({
    customer: registered,
    orders: [
      order("order_1", { created_at: "2026-10-01T10:00:00.000Z", shipping_address: { country_code: "ng" } }),
      order("order_2", { created_at: "2026-11-05T10:00:00.000Z", shipping_address: { country_code: "gb" } }),
      order("order_3", { status: "canceled" }),
      order("order_4", { customer: { id: "cus_other", has_account: true } }),
      order("order_5", { email: "ada@example.co" }),
    ],
  })

  await handler(args)

  expect(graph).toHaveBeenCalledWith(expect.objectContaining({ entity: "order", filters: { email: { $ilike: "ada@example.com" } } }))
  expect(run.mock.calls.map(([call]) => call.input)).toEqual([
    expect.objectContaining({ order_id: "order_2", customer_id: "cus_new", logged_in_user: "cus_new" }),
    expect.objectContaining({ order_id: "order_1", customer_id: "cus_new", logged_in_user: "cus_new" }),
  ])
  expect(createNotifications).toHaveBeenCalledTimes(1)
  const [notification] = createNotifications.mock.calls[0] as [{ to: string; template: string; data: { claim_url: string; orders: { display_id: number }[] } }]
  expect(notification).toMatchObject({ to: "ada@example.com", channel: "email", template: "order-transfer" })
  expect(notification.data.orders.map((entry) => entry.display_id)).toEqual([2, 1])
  expect(notification.data.claim_url).toBe("https://shop.example.com/gb/claim-orders#c=order_2.tok-order_2,order_1.tok-order_1")
})

it("escapes LIKE wildcards in the email filter", async () => {
  const { args, graph } = setup({ customer: { ...registered, email: "a_b%c@example.com" }, orders: [] })
  await handler(args)
  expect(graph).toHaveBeenCalledWith(expect.objectContaining({ entity: "order", filters: { email: { $ilike: "a\\_b\\%c@example.com" } } }))
})

it("skips orders whose transfer cannot be requested and still emails the rest", async () => {
  const { args, createNotifications, logger } = setup({ customer: registered, orders: [order("order_1"), order("order_2")], failOn: ["order_1"] })
  await handler(args)
  expect(logger.warn).toHaveBeenCalled()
  const [notification] = createNotifications.mock.calls[0] as [{ data: { claim_url: string } }]
  expect(notification.data.claim_url).toBe("https://shop.example.com/ng/claim-orders#c=order_2.tok-order_2")
})

it("does nothing without guest orders", async () => {
  const { args, run, createNotifications } = setup({ customer: registered, orders: [order("order_1", { customer: { id: "cus_new", has_account: true } })] })
  await handler(args)
  expect(run).not.toHaveBeenCalled()
  expect(createNotifications).not.toHaveBeenCalled()
})

it("does not create transfers when the storefront URL is not configured", async () => {
  delete process.env.STOREFRONT_URL
  const { args, run, createNotifications, logger } = setup({ customer: registered, orders: [order("order_1")] })
  await handler(args)
  expect(run).not.toHaveBeenCalled()
  expect(createNotifications).not.toHaveBeenCalled()
  expect(logger.warn).toHaveBeenCalled()
})
