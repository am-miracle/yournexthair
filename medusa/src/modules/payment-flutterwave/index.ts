import { Module } from "@medusajs/framework/utils"
import FlutterwavePaymentService from "./service"

export const FLUTTERWAVE_MODULE = "flutterwave"

export default Module(FLUTTERWAVE_MODULE, {
  service: FlutterwavePaymentService,
})
