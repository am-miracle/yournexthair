import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const setCookie = vi.hoisted(() => vi.fn())
vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }))

import { setCartId } from "../cookies"
import { checkoutKey } from "../../../../../medusa/src/utils/receipt-tokens"
import { getCheckoutKey } from "../../util/checkout-key"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it("generates a shared receipt credential that lets the E2E guest create a cart", async () => {
  const workflow = readFileSync(
    new URL("../../../../../.github/workflows/e2e.yml", import.meta.url),
    "utf8",
  )
  const step = workflow.match(/- name: Generate test secrets\n\s+run: \|\n((?: {10}.*\n)+)/)
  expect(step, "E2E must generate test credentials before starting either app").not.toBeNull()
  const script = step![1]!
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n")
  const directory = mkdtempSync(join(tmpdir(), "e2e-credentials-"))

  try {
    const envFile = join(directory, "github-env")
    execFileSync("bash", ["-e", "-c", script], {
      env: { PATH: process.env.PATH, GITHUB_ENV: envFile },
      stdio: "pipe",
    })
    const generated = Object.fromEntries(
      readFileSync(envFile, "utf8")
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=")
          return [line.slice(0, separator), line.slice(separator + 1)]
        }),
    )
    vi.stubEnv("RECEIPT_ACCESS_SECRET", generated.RECEIPT_ACCESS_SECRET)

    await setCartId("cart_e2e_guest")

    expect(setCookie).toHaveBeenCalledWith(
      "_medusa_cart_id",
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    )
    expect(getCheckoutKey()).toBe(checkoutKey())
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
