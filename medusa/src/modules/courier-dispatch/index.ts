import { Module } from "@medusajs/framework/utils"
import CourierDispatchService from "./service"

export const COURIER_DISPATCH = "courierDispatch"
export default Module(COURIER_DISPATCH, { service: CourierDispatchService })
