import { afterEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { POST } from "../route"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it("refreshes homepage catalog sections when collections or product types change", async () => {
  vi.stubEnv("STOREFRONT_REVALIDATE_SECRET", "test-secret")
  const response = await POST(new NextRequest("http://localhost:8000/api/revalidate", {
    method: "POST",
    headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
    body: JSON.stringify({ tags: ["collections", "product-types"] }),
  }))
  expect(response.status).toBe(200)
  expect(revalidateTag).toHaveBeenCalledWith("collections", "max")
  expect(revalidateTag).toHaveBeenCalledWith("product-types", "max")
  expect(revalidatePath).toHaveBeenCalledWith("/[countryCode]/(main)", "page")
})
