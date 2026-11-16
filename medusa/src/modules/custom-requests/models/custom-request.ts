import { model } from "@medusajs/framework/utils"
import { CUSTOM_REQUEST_STATUSES, HAIR_TYPES } from "../submission"

export default model.define("custom_request", {
  id: model.id({ prefix: "creq" }).primaryKey(),
  number: model.autoincrement(),
  submission_key: model.text().unique(),
  status: model.enum([...CUSTOM_REQUEST_STATUSES]).default("new"),
  name: model.text(),
  whatsapp: model.text(),
  email: model.text().nullable(),
  description: model.text(),
  country_code: model.text(),
  city: model.text(),
  hair_type: model.enum([...HAIR_TYPES]).nullable(),
  texture: model.text().nullable(),
  length: model.text().nullable(),
  budget: model.text().nullable(),
  quoted_amount: model.bigNumber().nullable(),
  quoted_currency: model.text().nullable(),
  admin_notes: model.text().nullable(),
})
