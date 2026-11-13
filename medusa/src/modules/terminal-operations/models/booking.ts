import { model } from "@medusajs/framework/utils"

export default model.define("terminal_booking", {
  id: model.id().primaryKey(),
  fulfillment_id: model.text().unique(),
  order_id: model.text(),
  environment: model.text(),
  state: model.text(),
  shipment_id: model.text().nullable(),
  result: model.json().nullable(),
  last_error: model.text().nullable(),
})
