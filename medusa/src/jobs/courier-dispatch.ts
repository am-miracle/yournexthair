import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURIER_DISPATCH } from "../modules/courier-dispatch"
import { dispatchCourier } from "../modules/courier-dispatch/dispatch"
import type CourierDispatchService from "../modules/courier-dispatch/service"

export default async function runCourierDispatch(container: MedusaContainer) {
  const dispatches: CourierDispatchService = container.resolve(COURIER_DISPATCH)
  for (const { order_id } of await dispatches.listDue(50)) {
    try {
      await dispatchCourier(container, order_id)
    } catch (error) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `Courier dispatch for ${order_id} could not run: ${error instanceof Error ? error.message : String(error)}`,
        )
    }
  }
}

export const config = { name: "courier-dispatch", schedule: "* * * * *" }
