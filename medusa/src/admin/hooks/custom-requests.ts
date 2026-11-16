import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CustomRequestStatus, HAIR_TYPES } from "../../modules/custom-requests/submission"

export type CustomRequestSummary = {
  id: string
  reference: string
  status: CustomRequestStatus
  name: string
  country_code: string
  city: string
  hair_type: (typeof HAIR_TYPES)[number] | null
  created_at: string
}

export type CustomRequest = CustomRequestSummary & {
  whatsapp: string
  email: string | null
  description: string
  texture: string | null
  length: string | null
  budget: string | null
  quoted_amount: number | null
  quoted_currency: string | null
  admin_notes: string | null
  updated_at: string
}

export type QuoteUpdate = {
  status: CustomRequestStatus
  quoted_amount: number | null
  quoted_currency: string | null
  admin_notes: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((body as { message?: string }).message || "Something went wrong.")
  }
  return body as T
}

export const useCustomRequests = (status: CustomRequestStatus | undefined, offset: number) =>
  useQuery({
    queryKey: ["custom-requests", status ?? "all", offset],
    queryFn: () =>
      request<{ custom_requests: CustomRequestSummary[]; count: number; limit: number }>(
        `/admin/custom-requests?offset=${offset}${status ? `&status=${status}` : ""}`,
      ),
  })

export const useCustomRequest = (id: string) =>
  useQuery({
    queryKey: ["custom-request", id],
    queryFn: () => request<{ custom_request: CustomRequest }>(`/admin/custom-requests/${id}`),
  })

export const useUpdateCustomRequest = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (update: QuoteUpdate) =>
      request<{ custom_request: CustomRequest }>(`/admin/custom-requests/${id}`, {
        method: "POST",
        body: JSON.stringify(update),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["custom-request", id], data)
      void queryClient.invalidateQueries({ queryKey: ["custom-requests"] })
    },
  })
}
