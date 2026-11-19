import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { COURIER_DISPATCH } from "../modules/courier-dispatch"
import type CourierDispatchService from "../modules/courier-dispatch/service"

export default async function courierDispatch({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const dispatches: CourierDispatchService = container.resolve(COURIER_DISPATCH)
  await dispatches.enqueue(event.data.id)
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "enqueue-courier-dispatch" },
}
