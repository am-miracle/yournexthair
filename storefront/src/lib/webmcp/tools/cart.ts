import { z } from "zod"
import {
  addToCart,
  deleteLineItem,
  retrieveCart,
  updateLineItem,
} from "@lib/data/cart"
import {
  CartSnapshot,
  WebMCPTool,
  WebMCPToolContext,
  WebMCPToolResult,
} from "../types"
import { mapCartToResult } from "../utils"

const cartManageSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    variant_id: z.string().min(1),
    quantity: z.number().int().positive().optional(),
    item_title: z.string().optional(),
  }),
  z.object({
    action: z.literal("remove"),
    line_id: z.string().min(1),
  }),
  z.object({
    action: z.literal("update"),
    line_id: z.string().min(1),
    quantity: z.number().int().positive(),
  }),
  z.object({ action: z.literal("view") }),
])

type CartManageInput = z.infer<typeof cartManageSchema>

const buildConfirmMessage = async (input: CartManageInput): Promise<string> => {
  if (input.action === "add") {
    const qty = input.quantity ?? 1
    const title = input.item_title ?? input.variant_id
    return `Add ${qty} × "${title}" to your cart?`
  }

  if (input.action === "remove") {
    const cart = await retrieveCart().catch(() => null)
    const item = cart?.items?.find((i) => i.id === input.line_id)
    return `Remove "${item?.title ?? input.line_id}" from your cart?`
  }

  if (input.action === "update") {
    const cart = await retrieveCart().catch(() => null)
    const item = cart?.items?.find((i) => i.id === input.line_id)
    return `Update "${item?.title ?? input.line_id}" quantity to ${input.quantity}?`
  }

  return ""
}

const getCountryCode = (context?: WebMCPToolContext): string =>
  context?.countryCode ?? ""

export const cartManage = async (
  rawInput: unknown,
  context?: WebMCPToolContext
): Promise<WebMCPToolResult<CartSnapshot>> => {
  const parsed = cartManageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    }
  }

  const input = parsed.data
  const countryCode = getCountryCode(context)

  if (!countryCode) {
    return {
      ok: false,
      error: {
        code: "INVALID_COUNTRY_CODE",
        message:
          "User must be on a localised page (e.g. /ng/store) before managing the cart.",
      },
    }
  }

  if (input.action !== "view" && context?.client) {
    const confirmMessage = await buildConfirmMessage(input)
    const confirmed = await context.client.requestUserInteraction(() =>
      Promise.resolve(window.confirm(confirmMessage))
    )

    if (!confirmed) {
      return {
        ok: false,
        error: { code: "USER_CANCELLED", message: "User cancelled cart action." },
      }
    }
  }

  try {
    switch (input.action) {
      case "add":
        await addToCart({
          variantId: input.variant_id,
          quantity: input.quantity ?? 1,
          countryCode,
        })
        break
      case "update":
        await updateLineItem({ lineId: input.line_id, quantity: input.quantity })
        break
      case "remove":
        await deleteLineItem(input.line_id)
        break
      case "view":
        break
    }

    const cart = await retrieveCart()

    if (!cart) {
      return {
        ok: false,
        error: { code: "CART_MISSING", message: "Cart is missing" },
      }
    }

    return {
      ok: true,
      data: mapCartToResult(cart),
      meta: { tool: "cart.manage" },
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "CART_OPERATION_FAILED",
        message:
          error instanceof Error ? error.message : "Failed to perform cart action",
      },
    }
  }
}

export const cartManageTool: WebMCPTool<CartManageInput, CartSnapshot> = {
  name: "cart.manage",
  description: "Manage shopping cart (add, remove, update, view)",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "remove", "update", "view"],
        description: "Action to perform",
      },
      variant_id: {
        type: "string",
        description: "Variant ID (required for add)",
      },
      item_title: {
        type: "string",
        description:
          "Human-readable product title shown in the confirmation dialog (optional for add, pass it if you know it)",
      },
      quantity: {
        type: "number",
        description:
          "Quantity for the action. Optional for add (defaults to 1), required for update.",
      },
      line_id: {
        type: "string",
        description: "Line item ID (required for remove/update)",
      },
    },
    required: ["action"],
    oneOf: [
      {
        properties: {
          action: { const: "add" },
          variant_id: { type: "string" },
        },
        required: ["action", "variant_id"],
      },
      {
        properties: {
          action: { const: "remove" },
          line_id: { type: "string" },
        },
        required: ["action", "line_id"],
      },
      {
        properties: {
          action: { const: "update" },
          line_id: { type: "string" },
          quantity: { type: "number", minimum: 1 },
        },
        required: ["action", "line_id", "quantity"],
      },
      {
        properties: {
          action: { const: "view" },
        },
        required: ["action"],
      },
    ],
    additionalProperties: false,
  },
  handler: cartManage,
}
