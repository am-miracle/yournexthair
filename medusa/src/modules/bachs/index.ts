import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BachsPaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [BachsPaymentService],
})
