/// <reference lib="dom" />
import * as React from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input, Label } from "@medusajs/ui"

type Booking = { id: string; order_id: string; fulfillment_id: string; environment: string; state: string; shipment_id: string | null; last_error: string | null }
export default function TerminalBookingsPage() {
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [message, setMessage] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [recovered, setRecovered] = React.useState<Record<string, string>>({})
  const load = React.useCallback(async () => {
    const response = await fetch("/admin/terminal-bookings", { credentials: "include" })
    if (!response.ok) throw new Error("Could not load Terminal bookings.")
    const result = await response.json() as { bookings: Booking[] }
    setBookings(result.bookings)
  }, [])
  React.useEffect(() => { void load().catch(() => setMessage("Could not load Terminal bookings.")) }, [load])
  async function reconcile(booking: Booking) {
    setBusy(true); setMessage("")
    try {
      const shipmentId = recovered[booking.id]?.trim()
      const response = await fetch("/admin/terminal-bookings", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id, ...(shipmentId ? { shipment_id: shipmentId } : {}) }),
      })
      if (!response.ok) {
        const error = await response.json() as { message?: string }
        throw new Error(error.message || "Reconciliation failed.")
      }
      setMessage("Booking reconciled.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reconciliation failed.") }
    finally { await load().catch(() => {}); setBusy(false) }
  }
  return <Container className="space-y-6">
    <Heading>Terminal bookings</Heading>
    <Text>Creating a fulfillment for a paid order books its courier when automatic booking is enabled. Uncertain purchases are checked against their saved shipment; they are never purchased again automatically.</Text>
    <Button variant="secondary" disabled={busy} onClick={() => { void load().catch(() => setMessage("Could not refresh bookings.")) }}>Refresh</Button>
    <Text role="status" aria-live="polite">{message}</Text>
    {!bookings.length && <Text>No courier bookings yet.</Text>}
    {bookings.map((booking) => <div key={booking.id} className="space-y-2 border-t pt-4">
      <Heading level="h2">{booking.order_id}</Heading>
      <Text>{booking.environment} · {booking.state} · {booking.fulfillment_id}</Text>
      <Text>Terminal shipment: {booking.shipment_id ?? "Not saved"}</Text>
      {booking.last_error && <Text>{booking.last_error}</Text>}
      {booking.state === "creating" && !booking.shipment_id && <div className="space-y-2">
        <Text>The draft request had an unknown outcome. Locate it in Terminal by the Medusa order/fulfillment metadata or contact Terminal support. Do not create a replacement shipment.</Text>
        <Label htmlFor={booking.id}>Recovered Terminal shipment ID</Label>
        <Input id={booking.id} value={recovered[booking.id] ?? ""} onChange={(event) => setRecovered((current) => ({ ...current, [booking.id]: event.target.value }))} />
      </div>}
      {booking.state !== "cancelled" && <Button disabled={busy} onClick={() => { void reconcile(booking) }}>Reconcile booking</Button>}
    </div>)}
  </Container>
}
export const config = defineRouteConfig({ label: "Terminal bookings" })
