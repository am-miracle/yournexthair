import { z } from "zod"
import { applyPromotions, removePromotions, retrieveCart } from "@lib/data/cart"
import { CartSnapshot, WebMCPTool, WebMCPToolContext, WebMCPToolResult } from "../types"
import { mapCartToResult } from "../utils"

const promotionSchema = z.object({
  code: z.string().min(1),
})

type PromotionInput = z.infer<typeof promotionSchema>

export const cartApplyPromotion = async (
  rawInput: unknown,
  context?: WebMCPToolContext
): Promise<WebMCPToolResult<CartSnapshot>> => {
  const parsed = promotionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    }
  }

  const { code } = parsed.data

  if (context?.client) {
    const confirmed = await context.client.requestUserInteraction(() =>
      Promise.resolve(window.confirm(`Apply promotion code "${code}" to your cart?`))
    )
    if (!confirmed) {
      return {
        ok: false,
        error: { code: "USER_CANCELLED", message: "User cancelled promotion." },
      }
    }
  }

  try {
    await applyPromotions([code])

    const cart = await retrieveCart()

    if (!cart) {
      return {
        ok: false,
        error: { code: "CART_MISSING", message: "No active cart found" },
      }
    }

    return {
      ok: true,
      data: mapCartToResult(cart),
      meta: { tool: "cart.applyPromotion" },
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "APPLY_FAILED",
        message:
          error instanceof Error ? error.message : "Failed to apply promotion code",
      },
    }
  }
}

export const cartRemovePromotion = async (
  rawInput: unknown,
  context?: WebMCPToolContext
): Promise<WebMCPToolResult<CartSnapshot>> => {
  const parsed = promotionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    }
  }

  const { code } = parsed.data

  if (context?.client) {
    const confirmed = await context.client.requestUserInteraction(() =>
      Promise.resolve(
        window.confirm(
          `Remove promotion code "${code}" from your cart? This will remove the associated discount.`
        )
      )
    )
    if (!confirmed) {
      return {
        ok: false,
        error: { code: "USER_CANCELLED", message: "User cancelled promotion removal." },
      }
    }
  }

  try {
    await removePromotions([code])

    const cart = await retrieveCart()

    if (!cart) {
      return {
        ok: false,
        error: { code: "CART_MISSING", message: "No active cart found" },
      }
    }

    return {
      ok: true,
      data: mapCartToResult(cart),
      meta: { tool: "cart.removePromotion" },
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "REMOVE_FAILED",
        message:
          error instanceof Error ? error.message : "Failed to remove promotion code",
      },
    }
  }
}

export const applyPromotionTool: WebMCPTool<PromotionInput, CartSnapshot> = {
  name: "cart.applyPromotion",
  description:
    "Apply a discount/promotion code to the shopping cart. Returns updated cart with applied discount, including new subtotal, total, and discount amount. Common error codes: INVALID_INPUT (promotion code is required), CART_MISSING (no active cart found), APPLY_FAILED (failed to apply promotion code).",
  annotations: {
    readOnlyHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description:
          "Promotion/discount code to apply (e.g., 'SUMMER25', 'FREESHIP')",
      },
    },
    additionalProperties: false,
    required: ["code"],
  },
  handler: cartApplyPromotion,
}

export const removePromotionTool: WebMCPTool<PromotionInput, CartSnapshot> = {
  name: "cart.removePromotion",
  description:
    "Remove a previously applied discount/promotion code from the shopping cart. Returns updated cart with recalculated totals after discount removal. Use this when the user wants to replace a code or remove an applied discount.",
  annotations: {
    readOnlyHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description:
          "Promotion/discount code to remove (must match an applied code)",
      },
    },
    additionalProperties: false,
    required: ["code"],
  },
  handler: cartRemovePromotion,
}
