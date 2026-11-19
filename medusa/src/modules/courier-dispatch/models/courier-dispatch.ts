import { model } from "@medusajs/framework/utils"
import { DISPATCH_STATES } from "../plan"

export default model.define("courier_dispatch", {
  id: model.id({ prefix: "cdsp" }).primaryKey(),
  order_id: model.text().unique(),
  state: model.enum([...DISPATCH_STATES]).default("pending"),
  carrier: model.text().nullable(),
  environment: model.text().nullable(),
  fulfillment_id: model.text().nullable(),
  waybill: model.text().nullable(),
  tracking_url: model.text().nullable(),
  attempts: model.number().default(0),
  last_error: model.text().nullable(),
  next_attempt_at: model.dateTime(),
})
