"use server"

import { FetchError } from "@medusajs/js-sdk"
import { sdk } from "@lib/config"
import type { CustomOrderSubmission } from "@lib/custom-order"

export type CustomOrderResult =
  | { state: "initial" }
  | { state: "success"; reference: string }
  | { state: "error"; error: string }

export async function submitCustomOrder(
  _previous: CustomOrderResult,
  submission: CustomOrderSubmission,
): Promise<CustomOrderResult> {
  try {
    const { custom_request } = await sdk.client.fetch<{ custom_request: { reference: string } }>(
      "/store/custom-requests",
      { method: "POST", body: submission, cache: "no-store" },
    )
    return { state: "success", reference: custom_request.reference }
  } catch (error) {
    if (error instanceof FetchError && error.status === 400 && error.message) {
      return { state: "error", error: error.message }
    }
    console.error("Custom order submission failed", error)
    return {
      state: "error",
      error: "We couldn't send your request just now. Please try again in a moment.",
    }
  }
}
