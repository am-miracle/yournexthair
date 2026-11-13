import bootstrap from "../bootstrap-render-free"
import { createUsersWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import setupBachs from "../setup-bachs"
import setupNigeriaVat from "../setup-nigeria-vat"

jest.mock("@medusajs/framework/utils", () => ({ ContainerRegistrationKeys: { LOGGER: "logger" }, Modules: { USER: "user", AUTH: "auth", STORE: "store" } }))
jest.mock("@medusajs/medusa/core-flows", () => ({ createUsersWorkflow: jest.fn() }))
jest.mock("../seed-regions", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("../setup-nigeria-vat", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("../setup-bachs", () => ({ __esModule: true, default: jest.fn() }))
const oldEnv = { ...process.env }
afterEach(() => { process.env = { ...oldEnv }; jest.resetAllMocks() })

it("creates login credentials without requiring the optional RBAC module", async () => {
  process.env.APP_ENV = "development"
  process.env.INITIAL_ADMIN_EMAIL = "admin@example.com"
  process.env.INITIAL_ADMIN_PASSWORD = "test-only-value"
  const run = jest.fn(({ input }: { input: { users: { email: string; roles?: string[] }[] } }) => {
    if (input.users.some((user) => user.roles?.length)) throw new Error("Could not resolve 'rbac'.")
    return Promise.resolve({ result: [{ id: "user_1" }] })
  })
  jest.mocked(createUsersWorkflow).mockReturnValue({ run } as unknown as ReturnType<typeof createUsersWorkflow>)
  const update = jest.fn().mockResolvedValue({})
  const services = {
    logger: { info: jest.fn() },
    user: { listUsers: jest.fn().mockResolvedValue([]), deleteUsers: jest.fn() },
    auth: { register: jest.fn().mockResolvedValue({ authIdentity: { id: "auth_1" } }), updateAuthIdentities: update },
  }
  const args = { container: { resolve: (key: keyof typeof services) => services[key] }, args: [] } as unknown as ExecArgs
  await bootstrap(args)
  expect(run).toHaveBeenCalledWith({ input: { users: [{ email: "admin@example.com" }] } })
  expect(update).toHaveBeenCalledWith({ id: "auth_1", app_metadata: { user_id: "user_1" } })
})

it("runs on production, configures VAT, and enables Bachs only once when its key is set", async () => {
  delete process.env.INITIAL_ADMIN_EMAIL
  delete process.env.INITIAL_ADMIN_PASSWORD
  process.env.APP_ENV = "production"
  const store = { id: "store_1", metadata: null as Record<string, unknown> | null }
  const stores = {
    listStores: jest.fn(() => Promise.resolve([store])),
    updateStores: jest.fn((_id: string, update: { metadata: Record<string, unknown> }) => { store.metadata = update.metadata; return Promise.resolve(store) }),
  }
  const args = { container: { resolve: (key: string) => (key === "store" ? stores : { info: jest.fn() }) }, args: [] } as unknown as ExecArgs

  delete process.env.BACHS_SECRET_KEY
  await bootstrap(args)
  expect(setupNigeriaVat).toHaveBeenCalledWith(args)
  expect(setupBachs).not.toHaveBeenCalled()

  process.env.BACHS_SECRET_KEY = "sk_sandbox_test"
  await bootstrap(args)
  await bootstrap(args)
  expect(setupBachs).toHaveBeenCalledTimes(1)
  expect(store.metadata).toEqual({ bachs_regions_enabled: true })
})
