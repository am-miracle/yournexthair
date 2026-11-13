import { Module } from "@medusajs/framework/utils"
import TerminalOperationsService from "./service"

export const TERMINAL_OPERATIONS = "terminalOperations"
export default Module(TERMINAL_OPERATIONS, { service: TerminalOperationsService })
