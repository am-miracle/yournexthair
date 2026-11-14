import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import DhlShippingService from "./service"
export default ModuleProvider(Modules.FULFILLMENT, { services: [DhlShippingService] })
