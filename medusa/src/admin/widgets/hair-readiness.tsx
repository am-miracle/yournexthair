import * as React from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import {
  Container,
  Heading,
  Text,
  Button,
  Drawer,
  IconButton,
  Input,
  Select,
  Switch,
  StatusBadge,
  clx,
} from "@medusajs/ui"
import { PencilSquare, ArrowPath, CheckCircleSolid, XCircleSolid } from "@medusajs/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { withQueryClient } from "../components/QueryClientProvider"

interface FieldInfo {
  field: string
  label: string
  type: "string" | "number" | "boolean" | "enum"
  enumValues: string[] | null
  rule: "required" | "optional"
  value: string | number | boolean | null
}

interface HairFieldsData {
  productForm: string | null
  fields: FieldInfo[]
  missingRequired: string[]
}

type FormValues = Record<string, string | number | boolean | null>

const FULFILLMENT_LABELS: Record<string, string> = {
  ready_to_ship: "Ready to ship",
  custom: "Made to order",
}

function formatDisplayValue(field: FieldInfo): string {
  const val = field.value
  if (val === null || val === undefined || val === "") return "—"
  if (field.type === "boolean") return val ? "Yes" : "No"
  if (field.field === "fulfillment_mode") return FULFILLMENT_LABELS[String(val)] ?? String(val)
  if (field.field === "length_in_inches") return `${val}"`
  if (field.field === "density") return `${val}%`
  return String(val)
}

const FieldRow: React.FC<{ field: FieldInfo; isMissing: boolean }> = ({ field, isMissing }) => {
  const isEmpty = field.value === null || field.value === undefined || field.value === ""
  return (
    <div className="flex items-center justify-between py-2">
      <Text size="small" className="text-fg-subtle dark:text-fg-subtle-dark shrink-0 mr-4">
        {field.label}
      </Text>
      <div className="flex items-center gap-1.5 min-w-0">
        {isEmpty ? (
          <>
            <Text
              size="small"
              className={clx(
                "truncate",
                isMissing
                  ? "text-red-500"
                  : "text-fg-muted dark:text-fg-muted-dark"
              )}
            >
              {isMissing ? "required" : "not set"}
            </Text>
            {isMissing && <XCircleSolid className="text-red-500 shrink-0" />}
          </>
        ) : (
          <>
            <Text size="small" className="truncate">{formatDisplayValue(field)}</Text>
            {field.rule === "required" && (
              <CheckCircleSolid className="text-green-500 shrink-0" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

const FormField: React.FC<{
  field: FieldInfo
  value: string | number | boolean | null
  onChange: (val: string | number | boolean | null) => void
}> = ({ field, value, onChange }) => {
  const isRequired = field.rule === "required"
  const label = (
    <Text size="small" className="block mb-1 text-fg-subtle dark:text-fg-subtle-dark">
      {field.label}
      {isRequired && <span className="text-red-500 ml-0.5">*</span>}
    </Text>
  )

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1">
        <Text size="small" className="text-fg-subtle dark:text-fg-subtle-dark">
          {field.label}
        </Text>
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    )
  }

  if (field.type === "enum" && field.enumValues) {
    return (
      <div>
        {label}
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(v || null)}>
          <Select.Trigger>
            <Select.Value placeholder={`Select ${field.label.toLowerCase()}`} />
          </Select.Trigger>
          <Select.Content>
            {field.enumValues.map((opt) => (
              <Select.Item key={opt} value={opt}>
                {field.field === "fulfillment_mode" ? (FULFILLMENT_LABELS[opt] ?? opt) : opt}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
    )
  }

  return (
    <div>
      {label}
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={value === null || value === undefined ? "" : String(value)}
        placeholder={field.label}
        onChange={(e) => {
          const raw = (e.target as unknown as { value: string }).value
          if (field.type === "number") {
            onChange(raw === "" ? null : Number(raw))
          } else {
            onChange(raw || null)
          }
        }}
      />
    </div>
  )
}

const HairReadinessWidget = withQueryClient(({ data }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = React.useState(false)
  const [formValues, setFormValues] = React.useState<FormValues>({})
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const query = useQuery<HairFieldsData>({
    queryKey: ["product", data.id, "hair-fields"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/admin/products/${data.id}/hair-fields`, {
        credentials: "include",
        signal,
      })
      if (!res.ok) throw new Error("Failed to load hair fields")
      return res.json() as Promise<HairFieldsData>
    },
  })

  const { productForm, fields = [], missingRequired = [] } = query.data ?? {}

  const booleanFields = fields.filter((f) => f.type === "boolean")
  const dataFields = fields.filter((f) => f.type !== "boolean")

  const openDrawer = () => {
    const initial: FormValues = {}
    for (const f of fields) {
      initial[f.field] = f.value
    }
    setFormValues(initial)
    setSaveError(null)
    setIsOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/admin/products/${data.id}/hair-fields`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        setSaveError(body.message ?? "Failed to save")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ["product", data.id, "hair-fields"] })
      setIsOpen(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          <Heading>Hair Attributes</Heading>
          <div className="flex items-center gap-2">
            {query.isSuccess && productForm && (
              <StatusBadge color={missingRequired.length === 0 ? "green" : "red"}>
                {missingRequired.length === 0
                  ? "Ready to publish"
                  : `${missingRequired.length} field${missingRequired.length > 1 ? "s" : ""} missing`}
              </StatusBadge>
            )}
            <IconButton
              variant="transparent"
              className="text-fg-muted dark:text-fg-muted-dark"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              isLoading={query.isFetching}
            >
              <ArrowPath />
            </IconButton>
          </div>
        </div>

        <div className="px-6 py-4">
          {query.isLoading && <Text>Loading...</Text>}
          {query.isError && <Text>Error loading hair attributes</Text>}
          {query.isSuccess && !productForm && (
            <Text className="text-fg-muted dark:text-fg-muted-dark text-sm">
              Hair attributes are not configured for this product type.
            </Text>
          )}
          {query.isSuccess && productForm && (
            <>
              <div className="flex flex-col divide-y mb-3">
                {dataFields.map((f) => (
                  <FieldRow key={f.field} field={f} isMissing={missingRequired.includes(f.field)} />
                ))}
              </div>
              {booleanFields.length > 0 && (
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4">
                  {booleanFields.map((f) => (
                    <div key={f.field} className="flex items-center gap-1.5">
                      <span
                        className={clx(
                          "w-2 h-2 rounded-full shrink-0",
                          f.value ? "bg-green-500" : "bg-grayscale-200"
                        )}
                      />
                      <Text size="small" className="text-fg-subtle dark:text-fg-subtle-dark">
                        {f.label}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="secondary" size="small" onClick={openDrawer}>
                <PencilSquare />
                Edit
              </Button>
            </>
          )}
        </div>
      </Container>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Hair Attributes</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 flex flex-col gap-4 overflow-y-auto">
            {dataFields.map((f) => (
              <FormField
                key={f.field}
                field={f}
                value={formValues[f.field] ?? null}
                onChange={(val) => setFormValues((prev) => ({ ...prev, [f.field]: val }))}
              />
            ))}
            {booleanFields.length > 0 && (
              <div className="flex flex-col gap-3 pt-3 border-t">
                {booleanFields.map((f) => (
                  <FormField
                    key={f.field}
                    field={f}
                    value={formValues[f.field] ?? null}
                    onChange={(val) => setFormValues((prev) => ({ ...prev, [f.field]: val }))}
                  />
                ))}
              </div>
            )}
            {saveError && (
              <Text className="text-red-500 text-sm mt-1">{saveError}</Text>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button onClick={() => void handleSave()} isLoading={isSaving} disabled={isSaving}>
              Save changes
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
})

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default HairReadinessWidget
