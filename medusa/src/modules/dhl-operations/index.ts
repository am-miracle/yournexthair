import { Module } from "@medusajs/framework/utils"
import DhlOperationsService from "./service"

export const DHL_OPERATIONS = "dhlOperations"
export default Module(DHL_OPERATIONS, { service: DhlOperationsService })
