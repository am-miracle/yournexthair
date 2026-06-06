import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import FlutterwavePaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [FlutterwavePaymentService],
})
