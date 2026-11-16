import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CUSTOM_REQUESTS, CUSTOM_REQUEST_CREATED } from "../modules/custom-requests"
import type CustomRequestsService from "../modules/custom-requests/service"
import {
  buildCustomerEmail,
  buildTeamEmail,
  notifyRecipients,
} from "../modules/custom-requests/notifications"

export default async function sendCustomRequestNotifications({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)
  const service: CustomRequestsService = container.resolve(CUSTOM_REQUESTS)

  const request = await service.retrieveCustomRequest(data.id)
  const { data: countries } = await query.graph({
    entity: "country",
    fields: ["display_name"],
    filters: { iso_2: request.country_code },
  })
  const countryName = countries[0]?.display_name ?? request.country_code.toUpperCase()

  const recipients = notifyRecipients(process.env.CUSTOM_REQUEST_NOTIFY_EMAIL)
  if (!recipients.length) {
    logger.warn(`CUSTOM_REQUEST_NOTIFY_EMAIL is not set; ${request.id} is only visible in Admin.`)
  }
  const teamEmail = buildTeamEmail(
    request,
    countryName,
    process.env.BACKEND_URL ?? "http://localhost:9000",
  )

  const sends = [
    ...recipients.map((to) => ({ to, template: "custom-request-received", data: teamEmail })),
    ...(request.email
      ? [
          {
            to: request.email,
            template: "custom-request-confirmation",
            data: buildCustomerEmail(request),
          },
        ]
      : []),
  ]

  const results = await Promise.allSettled(
    sends.map(({ to, template, data: payload }) =>
      notifications.createNotifications({ to, channel: "email", template, data: payload }),
    ),
  )
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error(
        `Failed to send ${sends[index]?.template} for custom request ${request.id}`,
        result.reason instanceof Error ? result.reason : undefined,
      )
    }
  })
}

export const config: SubscriberConfig = { event: CUSTOM_REQUEST_CREATED }
