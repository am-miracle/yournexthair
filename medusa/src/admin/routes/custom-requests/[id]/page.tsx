import * as React from "react"
import { ArrowUpRightOnBox } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { Link, useParams } from "react-router-dom"
import { withQueryClient } from "../../../components/QueryClientProvider"
import {
  CustomRequestStatusBadge,
  STATUS_LABELS,
  countryName,
  formatReceived,
} from "../../../components/CustomRequestStatusBadge"
import {
  useCustomRequest,
  useUpdateCustomRequest,
  type CustomRequest,
} from "../../../hooks/custom-requests"
import {
  CUSTOM_REQUEST_STATUSES,
  HAIR_TYPE_LABELS,
  type CustomRequestStatus,
} from "../../../../modules/custom-requests/submission"
import { followUpMessage, whatsappUrl } from "../../../../modules/custom-requests/whatsapp"

const CURRENCIES = ["ngn", "usd", "gbp", "eur", "cad"] as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4 px-6 py-3">
      <Text size="small" leading="compact" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="small" leading="compact" className="whitespace-pre-line break-words">
        {children}
      </Text>
    </div>
  )
}

function QuoteForm({ request }: { request: CustomRequest }) {
  const update = useUpdateCustomRequest(request.id)
  const [status, setStatus] = React.useState<CustomRequestStatus>(request.status)
  const [amount, setAmount] = React.useState(request.quoted_amount?.toString() ?? "")
  const [currency, setCurrency] = React.useState(request.quoted_currency ?? "ngn")
  const [notes, setNotes] = React.useState(request.admin_notes ?? "")
  const needsQuote = status === "quoted" && !amount

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const quotedAmount = amount ? Number(amount) : null
    update.mutate(
      {
        status,
        quoted_amount: quotedAmount,
        quoted_currency: quotedAmount ? currency : null,
        admin_notes: notes.trim() || null,
      },
      {
        onSuccess: () => toast.success(`${request.reference} saved`),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as CustomRequestStatus)}>
          <Select.Trigger id="status">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {CUSTOM_REQUEST_STATUSES.map((value) => (
              <Select.Item key={value} value={value}>
                {STATUS_LABELS[value]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="quoted_amount">Quoted price</Label>
          <Input
            id="quoted_amount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            aria-invalid={needsQuote}
            aria-describedby={needsQuote ? "quote-hint" : undefined}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quoted_currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <Select.Trigger id="quoted_currency">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {CURRENCIES.map((code) => (
                <Select.Item key={code} value={code}>
                  {code.toUpperCase()}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>
      {needsQuote && (
        <Text id="quote-hint" size="small" className="text-ui-fg-error">
          Add the price you quoted before saving as Quoted.
        </Text>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin_notes">Internal notes</Label>
        <Textarea
          id="admin_notes"
          rows={5}
          value={notes}
          placeholder="Specification agreed, delivery charge, production time…"
          onChange={(event) => setNotes(event.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-muted">
          Only visible to your team.
        </Text>
      </div>
      <Button type="submit" isLoading={update.isPending} disabled={needsQuote}>
        Save
      </Button>
    </form>
  )
}

function CustomRequestDetailPage() {
  const { id = "" } = useParams()
  const { data, isLoading, isError } = useCustomRequest(id)
  const request = data?.custom_request

  if (isLoading) {
    return <Text>Loading request…</Text>
  }
  if (isError || !request) {
    return (
      <Container>
        <Text>Couldn’t load this request.</Text>
        <Link to="/custom-requests" className="text-ui-fg-interactive">
          Back to custom orders
        </Link>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Link to="/custom-requests" className="text-ui-fg-subtle txt-compact-small">
        ← Custom orders
      </Link>
      <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">
          <Container className="divide-y p-0">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <Heading>{request.reference}</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Received {formatReceived(request.created_at)}
                </Text>
              </div>
              <CustomRequestStatusBadge status={request.status} />
            </div>
            <Field label="What they want">{request.description}</Field>
            <Field label="Hair type">
              {request.hair_type ? HAIR_TYPE_LABELS[request.hair_type] : "Not sure"}
            </Field>
            <Field label="Texture">{request.texture ?? "Not sure"}</Field>
            <Field label="Length">{request.length ?? "Not sure"}</Field>
            <Field label="Budget">{request.budget ?? "Not given"}</Field>
          </Container>
          <Container className="divide-y p-0">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <Heading level="h2">Customer</Heading>
              <Button size="small" variant="secondary" asChild>
                <a
                  href={whatsappUrl(
                    request.whatsapp,
                    followUpMessage(request.name, request.reference),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Message on WhatsApp
                  <ArrowUpRightOnBox />
                </a>
              </Button>
            </div>
            <Field label="Name">{request.name}</Field>
            <Field label="WhatsApp">{request.whatsapp}</Field>
            <Field label="Email">
              {request.email ? (
                <a href={`mailto:${request.email}`}>{request.email}</a>
              ) : (
                "Not given"
              )}
            </Field>
            <Field label="Deliver to">
              {request.city}, {countryName(request.country_code)}
            </Field>
          </Container>
        </div>
        <Container className="h-fit divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">Quote</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Record what you agreed with the customer on WhatsApp.
            </Text>
          </div>
          <QuoteForm key={request.updated_at} request={request} />
        </Container>
      </div>
    </div>
  )
}

export default withQueryClient(CustomRequestDetailPage)
