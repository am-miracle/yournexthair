import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import NigeriaShippingService from "./service"
export default ModuleProvider(Modules.FULFILLMENT, { services: [NigeriaShippingService] })
