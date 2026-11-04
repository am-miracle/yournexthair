import { afterEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it("reports missing regions instead of redirecting to the same URL", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => ({ regions: [] }),
  }))
  const { proxy } = await import("../proxy")
  const response = await proxy(new NextRequest("http://localhost:8000/"))
  expect(response.status).toBe(503)
  expect(response.headers.get("location")).toBeNull()
  expect(await response.text()).toContain("region")
})
