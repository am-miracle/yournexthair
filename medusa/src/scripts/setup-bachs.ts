import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

const BACHS_PROVIDER_ID = "pp_bachs_bachs"

export default async function setupBachs({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const payment = container.resolve(Modules.PAYMENT)

  const [provider] = await payment.listPaymentProviders({ id: BACHS_PROVIDER_ID, is_enabled: true })
  if (!provider) {
    throw new Error(
      `${BACHS_PROVIDER_ID} is not enabled. Set BACHS_SECRET_KEY and BACHS_WEBHOOK_SECRET first.`,
    )
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.id"],
  })

  for (const region of regions) {
    const current = (region.payment_providers ?? []).flatMap((p) => (p ? [p.id] : []))
    if (current.includes(BACHS_PROVIDER_ID)) {
      logger.info(`${region.name}: Bachs already enabled.`)
      continue
    }
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: { payment_providers: [...current, BACHS_PROVIDER_ID] },
      },
    })
    logger.info(`${region.name}: enabled Bachs.`)
  }
}
