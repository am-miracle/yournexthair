import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { listShippingOptionsForCartWithPricingWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"

const bodySchema = z.object({ cart_id: z.string().min(1) })
const optionSchema = z.object({
  id: z.string(), name: z.string(), price_type: z.string(),
  provider_id: z.string(), amount: z.number().finite().nonnegative(),
  is_tax_inclusive: z.boolean().optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = bodySchema.safeParse(req.body)
  if (!body.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, "A cart is required for shipping.")
  // In Medusa 2.15 the standalone calculate workflow omits cart currency.
  // Use the same eligibility/pricing workflow as addShippingMethodToCart instead.
  const { result } = await listShippingOptionsForCartWithPricingWorkflow(req.scope).run({
    input: { cart_id: body.data.cart_id, options: [{ id: req.params.id! }], is_return: false },
  })
  const options = z.array(optionSchema).parse(result)
  const option = options.find((entry) => entry.id === req.params.id)
  if (!option) throw new MedusaError(MedusaError.Types.NOT_FOUND, "This delivery option is not available for your cart.")
  // Exclude the warehouse address and other internal provider data from the response.
  res.json({ shipping_option: option })
}
