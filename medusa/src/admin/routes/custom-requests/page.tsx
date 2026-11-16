import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { withQueryClient } from "../../components/QueryClientProvider"
import {
  CustomRequestStatusBadge,
  STATUS_LABELS,
  countryName,
  formatReceived,
} from "../../components/CustomRequestStatusBadge"
import { useCustomRequests } from "../../hooks/custom-requests"
import {
  CUSTOM_REQUEST_STATUSES,
  HAIR_TYPE_LABELS,
  type CustomRequestStatus,
} from "../../../modules/custom-requests/submission"

const FILTERS = [undefined, ...CUSTOM_REQUEST_STATUSES] as const

function CustomRequestsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = CUSTOM_REQUEST_STATUSES.find((value) => value === searchParams.get("status"))
  const page = Math.max(0, Number(searchParams.get("page")) || 0)
  const { data, isLoading, isError } = useCustomRequests(status, page * 50)
  const pageSize = data?.limit ?? 50
  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / pageSize))

  const show = (next: { status?: CustomRequestStatus | undefined; page?: number }) => {
    const params = new URLSearchParams()
    const nextStatus = "status" in next ? next.status : status
    if (nextStatus) params.set("status", nextStatus)
    if (next.page) params.set("page", String(next.page))
    setSearchParams(params)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-4 px-6 py-4">
        <div>
          <Heading>Custom orders</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Requests from the custom-order form. Contact the customer on WhatsApp, then record your
            quote here.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((filter) => (
            <Button
              key={filter ?? "all"}
              size="small"
              variant={filter === status ? "secondary" : "transparent"}
              aria-pressed={filter === status}
              onClick={() => show({ status: filter, page: 0 })}
            >
              {filter ? STATUS_LABELS[filter] : "All"}
            </Button>
          ))}
        </div>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Reference</Table.HeaderCell>
            <Table.HeaderCell>Customer</Table.HeaderCell>
            <Table.HeaderCell>Deliver to</Table.HeaderCell>
            <Table.HeaderCell>Hair type</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Received</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data?.custom_requests.map((row) => (
            <Table.Row
              key={row.id}
              className="cursor-pointer"
              onClick={() => navigate(`/custom-requests/${row.id}`)}
            >
              <Table.Cell>
                <Link to={`/custom-requests/${row.id}`} className="font-medium">
                  {row.reference}
                </Link>
              </Table.Cell>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>
                {row.city}, {countryName(row.country_code)}
              </Table.Cell>
              <Table.Cell>
                {row.hair_type ? HAIR_TYPE_LABELS[row.hair_type] : "Not sure"}
              </Table.Cell>
              <Table.Cell>
                <CustomRequestStatusBadge status={row.status} />
              </Table.Cell>
              <Table.Cell>{formatReceived(row.created_at)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {(isLoading || isError || data?.custom_requests.length === 0) && (
        <Text className="px-6 py-8 text-ui-fg-subtle">
          {isLoading
            ? "Loading requests…"
            : isError
              ? "Couldn’t load requests. Refresh to try again."
              : status
                ? `No ${STATUS_LABELS[status].toLowerCase()} requests.`
                : "No custom-order requests yet."}
        </Text>
      )}
      <Table.Pagination
        count={data?.count ?? 0}
        pageSize={pageSize}
        pageIndex={page}
        pageCount={pageCount}
        canPreviousPage={page > 0}
        canNextPage={page + 1 < pageCount}
        previousPage={() => show({ page: page - 1 })}
        nextPage={() => show({ page: page + 1 })}
      />
    </Container>
  )
}

export default withQueryClient(CustomRequestsPage)

export const config = defineRouteConfig({ label: "Custom orders", icon: ChatBubbleLeftRight })
