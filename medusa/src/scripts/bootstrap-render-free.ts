import type { ExecArgs, IAuthModuleService, IUserModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createUsersWorkflow } from "@medusajs/medusa/core-flows"
import seedRegions from "./seed-regions"

// Free Render services have no Shell or pre-deploy commands. Run only on the
// free development stack; never reset an existing admin's password on restart.
export default async function bootstrapRenderFree(args: ExecArgs) {
  if (process.env.APP_ENV !== "development") throw new Error("Free bootstrap is restricted to the development environment.")
  const { container } = args
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.INITIAL_ADMIN_PASSWORD
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (email && password) {
    const users: IUserModuleService = container.resolve(Modules.USER)
    const auth: IAuthModuleService = container.resolve(Modules.AUTH)
    const [existing] = await users.listUsers({ email })
    if (!existing) {
      const { result } = await createUsersWorkflow(container).run({ input: { users: [{ email, roles: ["role_super_admin"] }] } })
      const user = result[0]
      if (!user) throw new Error("Could not create the initial Admin user.")
      try {
        const { authIdentity, error } = await auth.register("emailpass", { body: { email, password } })
        if (error || !authIdentity) throw new Error("Could not register the initial Admin credentials.")
        await auth.updateAuthIdentities({ id: authIdentity.id, app_metadata: { user_id: user.id } })
      } catch (error) {
        await users.deleteUsers([user.id])
        throw error
      }
      logger.info("Initial Admin created. Remove INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD from Render after signing in.")
    }
  } else if (email || password) {
    throw new Error("Provide both initial Admin variables, or remove both after setup.")
  }
  await seedRegions(args)
}
