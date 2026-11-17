import type { HttpTypes } from "@medusajs/types"
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const actions = vi.hoisted(() => ({
  updateLineItem: vi.fn(),
  deleteLineItem: vi.fn(),
  addToCart: vi.fn(),
}))

vi.mock("@lib/data/cart", () => actions)
vi.mock("@lib/data/fulfillment", () => ({}))
vi.mock("@lib/data/payment", () => ({}))

import { addLineItemMutation, deleteLineItemMutation, updateLineItemMutation } from "../cart"

type Item = { id: string; quantity: number }

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const cartOf = (...items: Item[]) => ({ id: "cart_1", items }) as unknown as HttpTypes.StoreCart

let queryClient: QueryClient
let server: HttpTypes.StoreCart
let fetchCart: ReturnType<typeof vi.fn<() => Promise<HttpTypes.StoreCart>>>
let unsubscribe: () => void

const cachedItems = () =>
  queryClient.getQueryData<HttpTypes.StoreCart>(["cart"])?.items?.map(({ id, quantity }) => ({
    id,
    quantity,
  }))
const cachedBadge = () => queryClient.getQueryData<number>(["cart", "cart-quantity"])

const settle = (promise: Promise<unknown>) => promise.catch(() => undefined)

const update = (lineId: string, quantity: number) =>
  settle(
    new MutationObserver(queryClient, updateLineItemMutation(queryClient)).mutate({
      lineId,
      quantity,
    }),
  )

const remove = (lineId: string) =>
  settle(new MutationObserver(queryClient, deleteLineItemMutation(queryClient)).mutate({ lineId }))

beforeEach(async () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  server = cartOf({ id: "A", quantity: 1 }, { id: "B", quantity: 1 })
  fetchCart = vi.fn(async () => structuredClone(server))
  const observer = new QueryObserver(queryClient, { queryKey: ["cart"], queryFn: fetchCart })
  unsubscribe = observer.subscribe(() => undefined)
  await vi.waitFor(() => expect(cachedItems()).toBeDefined())
  queryClient.setQueryData(["cart", "cart-quantity"], 2)
  fetchCart.mockClear()
  Object.values(actions).forEach((action) => action.mockReset())
})
afterEach(() => {
  unsubscribe()
  queryClient.clear()
})

it("keeps another item's successful update when a concurrent update fails", async () => {
  const a = deferred()
  const b = deferred()
  actions.updateLineItem.mockImplementation(({ lineId }: { lineId: string }) =>
    lineId === "A" ? a.promise : b.promise,
  )

  const updatingA = update("A", 2)
  const updatingB = update("B", 3)
  await vi.waitFor(() => expect(actions.updateLineItem).toHaveBeenCalledTimes(2))

  server = cartOf({ id: "A", quantity: 1 }, { id: "B", quantity: 3 })
  b.resolve()
  await updatingB
  a.reject(new Error("Out of stock"))
  await updatingA

  expect(cachedItems()).toEqual([
    { id: "A", quantity: 1 },
    { id: "B", quantity: 3 },
  ])
  expect(cachedBadge()).toBe(4)
})

it("does not refetch over a pending update when another update finishes first", async () => {
  const a = deferred()
  const b = deferred()
  actions.updateLineItem.mockImplementation(({ lineId }: { lineId: string }) =>
    lineId === "A" ? a.promise : b.promise,
  )

  const updatingA = update("A", 2)
  const updatingB = update("B", 3)
  await vi.waitFor(() => expect(actions.updateLineItem).toHaveBeenCalledTimes(2))

  b.resolve()
  await updatingB

  expect(fetchCart).not.toHaveBeenCalled()
  expect(cachedItems()).toEqual([
    { id: "A", quantity: 2 },
    { id: "B", quantity: 3 },
  ])

  server = cartOf({ id: "A", quantity: 2 }, { id: "B", quantity: 3 })
  a.resolve()
  await updatingA
  expect(fetchCart).toHaveBeenCalledOnce()
})

it("reconciles with the server after a failed update", async () => {
  actions.updateLineItem.mockRejectedValue(new Error("Server unavailable"))

  await update("A", 5)

  expect(cachedItems()).toEqual([
    { id: "A", quantity: 1 },
    { id: "B", quantity: 1 },
  ])
  expect(cachedBadge()).toBe(2)
  expect(fetchCart).toHaveBeenCalledOnce()
})

it("restores only the item whose delete failed, in its original position", async () => {
  const deletingA = deferred()
  const updatingB = deferred()
  actions.deleteLineItem.mockReturnValue(deletingA.promise)
  actions.updateLineItem.mockReturnValue(updatingB.promise)

  const deleting = remove("A")
  const updating = update("B", 4)
  await vi.waitFor(() => expect(actions.updateLineItem).toHaveBeenCalledOnce())

  server = cartOf({ id: "A", quantity: 1 }, { id: "B", quantity: 4 })
  updatingB.resolve()
  await updating
  deletingA.reject(new Error("Server unavailable"))
  await deleting

  expect(cachedItems()).toEqual([
    { id: "A", quantity: 1 },
    { id: "B", quantity: 4 },
  ])
  expect(cachedBadge()).toBe(5)
})

it("does not resurrect an item deleted while its update was failing", async () => {
  const updatingA = deferred()
  actions.updateLineItem.mockReturnValue(updatingA.promise)
  actions.deleteLineItem.mockResolvedValue(undefined)

  const updating = update("A", 3)
  await vi.waitFor(() => expect(actions.updateLineItem).toHaveBeenCalledOnce())
  server = cartOf({ id: "B", quantity: 1 })
  await remove("A")
  updatingA.reject(new Error("Line item not found"))
  await updating

  expect(cachedItems()).toEqual([{ id: "B", quantity: 1 }])
})

it("waits for in-flight line updates before refetching after an add", async () => {
  const updatingA = deferred()
  actions.updateLineItem.mockReturnValue(updatingA.promise)
  actions.addToCart.mockResolvedValue(undefined)

  const updating = update("A", 2)
  await vi.waitFor(() => expect(actions.updateLineItem).toHaveBeenCalledOnce())
  await new MutationObserver(queryClient, addLineItemMutation(queryClient)).mutate({
    variantId: "variant_1",
    quantity: 1,
    countryCode: "ng",
  })

  expect(fetchCart).not.toHaveBeenCalled()
  expect(cachedItems()).toContainEqual({ id: "A", quantity: 2 })

  updatingA.resolve()
  await updating
  expect(fetchCart).toHaveBeenCalledOnce()
})
