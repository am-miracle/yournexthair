import { StatusBadge } from "@medusajs/ui"
import type { CustomRequestStatus } from "../../modules/custom-requests/submission"

const STYLES = {
  new: { color: "orange", label: "New" },
  quoted: { color: "blue", label: "Quoted" },
  closed: { color: "grey", label: "Closed" },
} as const

export const CustomRequestStatusBadge = ({ status }: { status: CustomRequestStatus }) => (
  <StatusBadge color={STYLES[status].color}>{STYLES[status].label}</StatusBadge>
)

export const STATUS_LABELS: Record<CustomRequestStatus, string> = {
  new: STYLES.new.label,
  quoted: STYLES.quoted.label,
  closed: STYLES.closed.label,
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
export const countryName = (code: string) => regionNames.of(code.toUpperCase()) ?? code

export const formatReceived = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  )
