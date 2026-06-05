import { useRouter } from "next/navigation"

type AppRouterInstance = ReturnType<typeof useRouter>
import { isWebMCPSupported } from "./is-supported"
import {
  checkoutPrepareTool,
  navigateToCartTool,
  navigateToProductTool,
} from "./tools/checkout"
import { productsSearchTool } from "./tools/products-search"
import { cartManageTool } from "./tools/cart"
import { WebMCPClient, WebMCPToolContext } from "./types"
import { applyPromotionTool, removePromotionTool } from "./tools/promotion"
import { withDefinedProp } from "@lib/util/optional-props"

interface ModelContext {
  registerTool: (
    tool: {
      name: string
      description: string
      inputSchema: object
      execute: (input: unknown, client: WebMCPClient) => Promise<unknown>
      annotations?: {
        readOnlyHint?: boolean
      }
    },
    options?: { signal?: AbortSignal }
  ) => void
  unregisterTool?: (name: string) => void
}

interface NavigatorWithModelContext extends globalThis.Navigator {
  modelContext: ModelContext
}

interface DocumentWithModelContext extends globalThis.Document {
  modelContext?: ModelContext
}

const getModelContext = (): ModelContext | null => {
  const documentModelContext = (document as DocumentWithModelContext).modelContext
  if (documentModelContext) {
    return documentModelContext
  }

  return (navigator as unknown as NavigatorWithModelContext).modelContext ?? null
}

export const registerWebMCPTools = (
  router?: AppRouterInstance,
  countryCode?: string
) => {
  if (!isWebMCPSupported()) {
    console.info("WebMCP is not supported, skipping registration")
    return () => {}
  }

  if (!countryCode) {
    return () => {}
  }

  const modelContext = getModelContext()
  if (!modelContext) {
    console.info("WebMCP model context is unavailable, skipping registration")
    return () => {}
  }

  const controller = new AbortController()

  type RegisterableWebMCPTool = {
    name: string
    description: string
    inputSchema: object
    annotations?: {
      readOnlyHint?: boolean
    }
    handler: (
      input: unknown,
      context?: WebMCPToolContext
    ) => Promise<unknown>
  }

  const tools: RegisterableWebMCPTool[] = [
    productsSearchTool,
    navigateToProductTool,
    navigateToCartTool,
    cartManageTool,
    applyPromotionTool,
    removePromotionTool,
    checkoutPrepareTool,
  ] as RegisterableWebMCPTool[]

  try {
    tools.forEach((tool) => {
      modelContext.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          ...withDefinedProp("annotations", tool.annotations),
          execute: async (input, client) => {
            return await tool.handler(input, {
              client,
              countryCode,
              ...withDefinedProp("router", router),
            })
          },
        },
        { signal: controller.signal }
      )
    })
  } catch (error) {
    console.error("WebMCP registration failed", error)
  }

  return () => {
    // Explicitly unregister each tool if the API supports it.
    // Fall back to aborting the signal for implementations that honour it.
    if (typeof modelContext.unregisterTool === "function") {
      tools.forEach((tool) => modelContext.unregisterTool!(tool.name))
    }
    controller.abort()
  }
}
