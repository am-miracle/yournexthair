/// <reference lib="dom" />
import * as React from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input, Label } from "@medusajs/ui"
import type { PackagingSettings } from "../../../modules/terminal-shipping/config"

type ShippingOption = { id: string; name: string; settings: PackagingSettings | null }
type SetupResponse = { configured: boolean; shipping_options: ShippingOption[] }
const emptySettings = {
  name: "", weight_grams: "", length_cm: "", width_cm: "", height_cm: "",
  max_items: "", max_content_weight_grams: "", carrier_reference: "",
}
type FormState = typeof emptySettings
const fields: { key: keyof FormState; label: string; type: "text" | "number" }[] = [
  { key: "name", label: "Package name", type: "text" },
  { key: "weight_grams", label: "Empty packaging weight (grams)", type: "number" },
  { key: "length_cm", label: "Outer length (cm)", type: "number" },
  { key: "width_cm", label: "Outer width (cm)", type: "number" },
  { key: "height_cm", label: "Outer height (cm)", type: "number" },
  { key: "max_items", label: "Maximum items that fit this package", type: "number" },
  { key: "max_content_weight_grams", label: "Maximum contents weight (grams)", type: "number" },
  { key: "carrier_reference", label: "Preferred carrier reference (optional)", type: "text" },
]

export default function TerminalShippingPage() {
  const [setup, setSetup] = React.useState<SetupResponse | null>(null)
  const [selectedId, setSelectedId] = React.useState("")
  const [form, setForm] = React.useState<FormState>(emptySettings)
  const [message, setMessage] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    const controller = new AbortController()
    fetch("/admin/terminal-shipping", { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load shipping settings.")
        setSetup(await response.json() as SetupResponse)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Could not load shipping settings.")
      })
    return () => controller.abort()
  }, [])

  function selectOption(id: string) {
    setSelectedId(id)
    const settings = setup?.shipping_options.find((option) => option.id === id)?.settings
    setForm(settings ? Object.fromEntries(Object.entries(settings).filter(([key]) => key in emptySettings).map(([key, value]) => [key, String(value)])) as FormState : emptySettings)
    setMessage("")
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      const settings = Object.fromEntries(fields.map(({ key, type }) => [key, type === "number" ? Number(form[key]) : form[key]])) as PackagingSettings
      const response = await fetch("/admin/terminal-shipping", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping_option_id: selectedId, settings }),
      })
      const result = await response.json() as { settings?: PackagingSettings; message?: string }
      if (!response.ok) throw new Error(result.message || "Could not save shipping settings.")
      setSetup((current) => current ? { ...current, shipping_options: current.shipping_options.map((option) => option.id === selectedId ? { ...option, settings: result.settings ?? settings } : option) } : current)
      setMessage("Shipping package saved.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save shipping settings.")
    } finally { setSaving(false) }
  }

  return (
    <Container className="space-y-6">
      <div><Heading>Terminal shipping</Heading><Text>Manage the package used for live courier quotes.</Text></div>
      <Text>Set each product variant’s weight in grams and its folded or packed dimensions in centimetres under Products → variant → Edit. Hair length in inches belongs in the hair attributes, not the shipping length field.</Text>
      <Text>Your pickup address comes from the stock location linked to the shipping option. Manage its street address, city (Port Harcourt), state (Rivers), country, postal code and phone under Settings → Locations &amp; Shipping.</Text>
      {setup && !setup.configured && <Text>Ask your developer to configure the backend’s Terminal API key before enabling live shipping.</Text>}
      {setup?.configured && !setup.shipping_options.length && <Text>In Settings → Locations &amp; Shipping, enable Terminal at your stock location, link the location to the store’s sales channel, create a delivery service zone, then add a calculated Terminal shipping option using “Live courier delivery”. Return here to configure its package.</Text>}
      <form onSubmit={(event) => { void save(event) }} className="space-y-4 max-w-xl">
        <Label htmlFor="terminal-option">Shipping option</Label>
        <select id="terminal-option" className="w-full rounded border p-2" value={selectedId} onChange={(event) => selectOption(event.target.value)} disabled={!setup?.configured || saving}>
          <option value="">Select a shipping option</option>
          {setup?.shipping_options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        {selectedId && fields.map(({ key, label, type }) => <div key={key} className="space-y-2">
          <Label htmlFor={`terminal-${key}`}>{label}</Label>
          <Input id={`terminal-${key}`} type={type} value={form[key]} required={key !== "carrier_reference"}
            {...(type === "number" ? { min: key === "weight_grams" ? 0 : 0.01, step: key === "max_items" ? 1 : "any" } : {})}
            disabled={saving} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
        </div>)}
        <Text>Use a capacity you have tested by packing real orders. Oversized orders need a delivery quote from your team. The cheapest available pickup service is used unless you specify a carrier reference.</Text>
        <Button type="submit" isLoading={saving} disabled={!selectedId || !setup?.configured}>Save package</Button>
        <Text role="status" aria-live="polite">{message}</Text>
      </form>
      <Text>Rates do not book or pay for courier shipments. After payment, book the shipment in Terminal Africa, then enter its tracking details when dispatching the order in Medusa.</Text>
    </Container>
  )
}
export const config = defineRouteConfig({ label: "Terminal shipping" })
