import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { OrderWorkflowEvents } from "@medusajs/framework/utils"
import { processTerminalBooking } from "../modules/terminal-shipping/process-booking"

export default async function terminalBooking({ event, container }: SubscriberArgs<{ order_id: string; fulfillment_id: string }>) {
  await processTerminalBooking(container, event.data.order_id, event.data.fulfillment_id)
}
export const config: SubscriberConfig = {
  event: [OrderWorkflowEvents.FULFILLMENT_CREATED, OrderWorkflowEvents.FULFILLMENT_CANCELED],
  context: { subscriberId: "terminal-courier-booking" },
}
