import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { OrderWorkflowEvents } from "@medusajs/framework/utils"
import { processDhlBooking } from "../modules/dhl-shipping/process-booking"

export default async function dhlBooking({
  event,
  container,
}: SubscriberArgs<{ order_id: string; fulfillment_id: string }>) {
  await processDhlBooking(container, event.data.order_id, event.data.fulfillment_id)
}
export const config: SubscriberConfig = {
  event: [OrderWorkflowEvents.FULFILLMENT_CREATED, OrderWorkflowEvents.FULFILLMENT_CANCELED],
  context: { subscriberId: "dhl-courier-booking" },
}
