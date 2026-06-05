import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function addNgnPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModuleService = container.resolve(Modules.PRODUCT)
  const pricingModuleService = container.resolve(Modules.PRICING)
  const regionModuleService = container.resolve(Modules.REGION)

  logger.info("Fetching Nigeria region...")
  const [nigeriaRegion] = await regionModuleService.listRegions({
    name: "Nigeria",
  })

  if (!nigeriaRegion) {
    throw new Error("Nigeria region not found. Run the seed first.")
  }

  logger.info("Fetching all products and variants...")
  const products = await productModuleService.listProducts({}, { relations: ["variants"] })

  const allVariants = products.flatMap((p) => p.variants ?? [])
  logger.info(`Found ${allVariants.length} variants.`)

  logger.info("Fetching existing price sets for variants...")
  const priceSets = await pricingModuleService.listPriceSets({}, { relations: ["prices"] })

  // Map price set → existing USD amount so we can derive NGN
  // NGN conversion: 1 USD ≈ 1200 NGN (adjust as needed)
  const NGN_PER_USD = 1300

  let updated = 0

  for (const priceSet of priceSets) {
    const usdPrice = priceSet.prices?.find((p) => p.currency_code === "usd")
    const ngnExists = priceSet.prices?.find((p) => p.currency_code === "ngn")

    if (ngnExists) continue
    if (!usdPrice) continue

    const ngnAmount = Math.round(((usdPrice.amount as number) * NGN_PER_USD) / 100) * 100

    await pricingModuleService.addPrices([
      {
        priceSetId: priceSet.id,
        prices: [
          {
            currency_code: "ngn",
            amount: ngnAmount,
          },
        ],
      },
    ])

    updated++
    logger.info(`Added NGN price ₦${ngnAmount.toLocaleString()} to price set ${priceSet.id}`)
  }

  logger.info(`Done. Added NGN prices to ${updated} price sets.`)
}
