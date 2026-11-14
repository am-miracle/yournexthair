import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import PaymentDetails from "../index"

beforeEach(() => vi.stubGlobal("React", React))
afterEach(() => vi.unstubAllGlobals())
function receipt(status: string, payments: Record<string, unknown>[] = []) {
  return renderToStaticMarkup(
    React.createElement(PaymentDetails, {
      order: {
        currency_code: "ngn",
        payment_status: status,
        payment_collections: [{ id: "pc_1", payments }],
      } as unknown as HttpTypes.StoreOrder,
    }),
  )
}
const payment = {
  id: "pay_1",
  provider_id: "pp_unknown",
  amount: 50000,
  created_at: "2026-11-13T12:00:00Z",
}
it("never labels an authorized payment as paid using its creation date", () => {
  const html = receipt("authorized", [{ ...payment, captured_amount: 0, refunded_amount: 0 }])
  expect(html).toContain("Authorized — awaiting capture")
  expect(html).toContain("Captured: NGN 0.00")
  expect(html).not.toContain("paid on")
  expect(html).not.toContain("13 Nov")
})
it.each([
  ["not_paid", "Not paid"],
  ["awaiting", "Payment pending"],
  ["canceled", "Payment canceled"],
  ["partially_captured", "Partially captured"],
  ["captured", "Captured"],
  ["partially_refunded", "Partially refunded"],
  ["refunded", "Refunded"],
  ["requires_action", "Payment requires action"],
])("shows the actual %s status", (status, label) => {
  expect(receipt(status, [payment])).toContain(label)
})
it("shows captured, refunded and net amounts rather than the payment's face value", () => {
  const html = receipt("partially_refunded", [
    { ...payment, captured_amount: 30000, refunded_amount: 5000 },
  ])
  expect(html).toContain("Captured: NGN 30,000.00")
  expect(html).toContain("Refunded: NGN 5,000.00")
  expect(html).toContain("Net collected: NGN 25,000.00")
  expect(html).not.toContain("50,000")
})
it("uses only a real capture timestamp", () => {
  const html = receipt("captured", [
    { ...payment, captured_amount: 50000, captured_at: "2026-11-14T12:00:00Z" },
  ])
  expect(html).toContain("Captured on 14 Nov 2026")
  expect(html).not.toContain("13 Nov")
})
it("does not invent unknown amounts or dates", () => {
  const html = receipt("authorized", [payment])
  expect(html).toContain("Captured: Unavailable")
  expect(html).toContain("Refunded: Unavailable")
  expect(html).not.toContain("Captured on")
})
it("renders every collection and payment", () => {
  const order = {
    currency_code: "ngn",
    payment_status: "captured",
    payment_collections: [
      {
        id: "pc_1",
        payments: [
          { ...payment, captured_amount: 100, refunded_amount: 0 },
          { ...payment, id: "pay_2", captured_amount: 200, refunded_amount: 0 },
        ],
      },
      {
        id: "pc_2",
        payments: [{ ...payment, id: "pay_3", captured_amount: 300, refunded_amount: 0 }],
      },
    ],
  } as unknown as HttpTypes.StoreOrder
  const html = renderToStaticMarkup(React.createElement(PaymentDetails, { order }))
  for (const amount of [100, 200, 300]) expect(html).toContain(`Captured: NGN ${amount}.00`)
})
it("shows pending status without a payment record", () => {
  expect(receipt("awaiting")).toContain("Payment pending")
})
it("does not crash on an invalid capture date", () => {
  expect(
    receipt("captured", [{ ...payment, captured_amount: 50000, captured_at: "invalid" }]),
  ).not.toContain("Captured on")
})

it("sums loaded captures and refunds when payment totals are absent", () => {
  const html = receipt("partially_refunded", [
    {
      ...payment,
      captures: [{ amount: 10000 }, { amount: 20000 }],
      refunds: [{ amount: 2000 }, { amount: 3000 }],
    },
  ])
  expect(html).toContain("Captured: NGN 30,000.00")
  expect(html).toContain("Refunded: NGN 5,000.00")
  expect(html).toContain("Net collected: NGN 25,000.00")
})
it("treats loaded empty capture and refund records as zero", () => {
  const html = receipt("canceled", [
    { ...payment, canceled_at: payment.created_at, captures: [], refunds: [] },
  ])
  expect(html).toContain("Captured: NGN 0.00")
  expect(html).toContain("Refunded: NGN 0.00")
  expect(html).not.toContain("Captured on")
})
it("shows a fully refunded payment with zero net collected", () => {
  const html = receipt("refunded", [{ ...payment, captured_amount: 50000, refunded_amount: 50000 }])
  expect(html).toContain("Refunded: NGN 50,000.00")
  expect(html).toContain("Net collected: NGN 0.00")
})
it("does not use collection totals in addition to individual payments", () => {
  const html = renderToStaticMarkup(
    React.createElement(PaymentDetails, {
      order: {
        currency_code: "ngn",
        payment_status: "captured",
        payment_collections: [
          {
            id: "pc_1",
            captured_amount: 100,
            refunded_amount: 0,
            payments: [{ ...payment, captured_amount: 100, refunded_amount: 0 }],
          },
        ],
      } as unknown as HttpTypes.StoreOrder,
    }),
  )
  expect(html.match(/Captured: NGN 100.00/g)).toHaveLength(1)
})
