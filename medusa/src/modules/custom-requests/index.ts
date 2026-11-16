import { Module } from "@medusajs/framework/utils"
import CustomRequestsService from "./service"

export const CUSTOM_REQUESTS = "customRequests"
export const CUSTOM_REQUEST_CREATED = "custom_request.created"
export default Module(CUSTOM_REQUESTS, { service: CustomRequestsService })
