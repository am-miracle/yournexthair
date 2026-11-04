import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import TerminalShippingService from "./service"
export default ModuleProvider(Modules.FULFILLMENT, { services: [TerminalShippingService] })
