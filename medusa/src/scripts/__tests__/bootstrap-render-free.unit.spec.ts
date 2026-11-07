import bootstrap from "../bootstrap-render-free"
import { createUsersWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"

jest.mock("@medusajs/framework/utils", () => ({ ContainerRegistrationKeys: { LOGGER: "logger" }, Modules: { USER: "user", AUTH: "auth" } }))
jest.mock("@medusajs/medusa/core-flows", () => ({ createUsersWorkflow: jest.fn() }))
jest.mock("../seed-regions", () => ({ __esModule: true, default: jest.fn() }))
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
