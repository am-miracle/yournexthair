import {
  addToCart,
  applyPromotions,
  deleteLineItem,
  getCartQuantity,
  initiatePaymentSession,
  placeOrder,
  retrieveCart,
  setAddresses,
  setEmail,
  setShippingMethod,
  updateLineItem,
  updateRegion,
} from "@lib/data/cart"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import {
  QueryClient,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

export const useCart = ({ enabled }: { enabled: boolean }) => {
  return useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await retrieveCart()
      return res
    },
    enabled,
  })
}

export const useCartQuantity = () => {
  return useQuery({
    queryKey: ["cart", "cart-quantity"],
    queryFn: async () => {
      const res = await getCartQuantity()
      return res
    },
  })
}

export const useCartShippingMethods = (cartId: string) => {
  return useQuery({
    queryKey: ["cart", cartId, "shipping-methods"],
    queryFn: async () => {
      const res = await listCartShippingMethods(cartId)
      return res
    },
    enabled: Boolean(cartId),
  })
}

export const useCartPaymentMethods = (regionId: string) => {
  return useQuery({
    queryKey: [regionId],
    queryFn: async () => {
      const res = await listCartPaymentMethods(regionId)
      return res
    },
  })
}

const CART_LINE_MUTATION_KEY = ["cart-line"] as const

type Cart = HttpTypes.StoreCart | null | undefined

const updateCachedCart = (
  queryClient: QueryClient,
  update: (cart: HttpTypes.StoreCart) => HttpTypes.StoreCart,
) => {
  queryClient.setQueryData<Cart>(["cart"], (old) => (old ? update(old) : old))
}

const adjustCachedQuantity = (queryClient: QueryClient, delta: number) => {
  if (!delta) return
  queryClient.setQueryData<number>(["cart", "cart-quantity"], (old) =>
    Math.max(0, (old ?? 0) + delta),
  )
}

// Refetching while another line mutation is in flight would overwrite its optimistic state,
// so only the last one to settle reconciles. The settling mutation still counts as pending here.
const reconcileCartWhenIdle = async (queryClient: QueryClient) => {
  if (queryClient.isMutating({ mutationKey: CART_LINE_MUTATION_KEY }) === 1) {
    await queryClient.invalidateQueries({ exact: false, queryKey: ["cart"] })
  }
}

type UpdateLineItemContext = {
  previousQuantity: number | undefined
  quantityDelta: number
}

export const updateLineItemMutation = (
  queryClient: QueryClient,
  options?: UseMutationOptions<
    void,
    Error,
    { lineId: string; quantity: number },
    UpdateLineItemContext
  >,
): UseMutationOptions<
  void,
  Error,
  { lineId: string; quantity: number },
  UpdateLineItemContext
> => ({
  ...options,
  mutationKey: [...CART_LINE_MUTATION_KEY, "update"],
  mutationFn: (payload) => updateLineItem(payload),
  onMutate: async (variables, context) => {
    const { lineId, quantity } = variables
    await queryClient.cancelQueries({ queryKey: ["cart"] })
    await options?.onMutate?.(variables, context)

    const previousQuantity = queryClient
      .getQueryData<Cart>(["cart"])
      ?.items?.find((item) => item.id === lineId)?.quantity

    updateCachedCart(queryClient, (cart) => ({
      ...cart,
      items: (cart.items ?? []).map((item) => (item.id === lineId ? { ...item, quantity } : item)),
    }))

    const quantityDelta = previousQuantity === undefined ? 0 : quantity - previousQuantity
    adjustCachedQuantity(queryClient, quantityDelta)

    return { previousQuantity, quantityDelta }
  },
  onError: async (error, variables, onMutateResult, context) => {
    if (onMutateResult?.previousQuantity !== undefined) {
      const { previousQuantity } = onMutateResult
      updateCachedCart(queryClient, (cart) => ({
        ...cart,
        items: (cart.items ?? []).map((item) =>
          item.id === variables.lineId ? { ...item, quantity: previousQuantity } : item,
        ),
      }))
      adjustCachedQuantity(queryClient, -onMutateResult.quantityDelta)
    }

    await options?.onError?.(error, variables, onMutateResult, context)
  },
  onSettled: async (...args) => {
    await reconcileCartWhenIdle(queryClient)
    await options?.onSettled?.(...args)
  },
})

export const useUpdateLineItem = (
  options?: UseMutationOptions<
    void,
    Error,
    { lineId: string; quantity: number },
    UpdateLineItemContext
  >,
) => {
  const queryClient = useQueryClient()
  return useMutation(updateLineItemMutation(queryClient, options))
}

type LineItemQuantityUpdater = {
  quantity: number
  error: Error | null
  onQuantityChange: (value: number) => void
  onQuantityCommit: (value: number) => void
  onQuantityFocus: () => void
  onQuantityBlur: () => void
}

export const useLineItemQuantityUpdater = ({
  lineId,
  initialQuantity,
}: {
  lineId: string
  initialQuantity: number
}): LineItemQuantityUpdater => {
  const { mutateAsync, error, reset } = useUpdateLineItem({
    onSuccess: () => {
      reset()
    },
  })
  const [quantity, setQuantity] = useState(initialQuantity)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const queuedQuantityRef = useRef<number | null>(null)
  const lastCommittedRef = useRef(initialQuantity)
  const isEditingRef = useRef(false)

  useEffect(() => {
    lastCommittedRef.current = initialQuantity

    if (isEditingRef.current) return
    setQuantity(initialQuantity)
  }, [initialQuantity])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const flushQuantityUpdate = useCallback(async () => {
    if (inFlightRef.current) return
    const quantityToCommit = queuedQuantityRef.current
    if (quantityToCommit === null || quantityToCommit === lastCommittedRef.current) {
      return
    }

    inFlightRef.current = true
    queuedQuantityRef.current = null
    lastCommittedRef.current = quantityToCommit

    try {
      await mutateAsync({ lineId, quantity: quantityToCommit }).catch(() => undefined)
    } finally {
      inFlightRef.current = false
      if (queuedQuantityRef.current !== null) {
        void flushQuantityUpdate()
      }
    }
  }, [lineId, mutateAsync])

  const scheduleQuantityUpdate = useCallback(
    (nextQuantity: number) => {
      queuedQuantityRef.current = nextQuantity
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void flushQuantityUpdate()
      }, 350)
    },
    [flushQuantityUpdate],
  )

  const onQuantityChange = useCallback(
    (newQuantity: number) => {
      setQuantity(newQuantity)
      scheduleQuantityUpdate(newQuantity)
    },
    [scheduleQuantityUpdate],
  )

  const onQuantityCommit = useCallback(
    (newQuantity: number) => {
      queuedQuantityRef.current = newQuantity
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      void flushQuantityUpdate()
    },
    [flushQuantityUpdate],
  )

  const onQuantityFocus = useCallback(() => {
    isEditingRef.current = true
  }, [])

  const onQuantityBlur = useCallback(() => {
    isEditingRef.current = false
  }, [])

  return {
    quantity,
    error: error ?? null,
    onQuantityChange,
    onQuantityCommit,
    onQuantityFocus,
    onQuantityBlur,
  }
}

type DeleteLineItemContext = {
  removedItem: HttpTypes.StoreCartLineItem | undefined
  removedIndex: number
}

export const deleteLineItemMutation = (
  queryClient: QueryClient,
  options?: UseMutationOptions<void, Error, { lineId: string }, DeleteLineItemContext>,
): UseMutationOptions<void, Error, { lineId: string }, DeleteLineItemContext> => ({
  ...options,
  mutationKey: [...CART_LINE_MUTATION_KEY, "delete"],
  mutationFn: ({ lineId }) => deleteLineItem(lineId),
  onMutate: async (variables, context) => {
    await queryClient.cancelQueries({ queryKey: ["cart"] })
    await options?.onMutate?.(variables, context)

    const items = queryClient.getQueryData<Cart>(["cart"])?.items ?? []
    const removedIndex = items.findIndex((item) => item.id === variables.lineId)
    const removedItem = items[removedIndex]

    updateCachedCart(queryClient, (cart) => ({
      ...cart,
      items: (cart.items ?? []).filter((item) => item.id !== variables.lineId),
    }))
    adjustCachedQuantity(queryClient, -(removedItem?.quantity ?? 0))

    return { removedItem, removedIndex }
  },
  onError: async (error, variables, onMutateResult, context) => {
    const removedItem = onMutateResult?.removedItem
    if (removedItem) {
      updateCachedCart(queryClient, (cart) => {
        const items = cart.items ?? []
        if (items.some((item) => item.id === removedItem.id)) return cart
        const restored = [...items]
        restored.splice(Math.min(onMutateResult.removedIndex, items.length), 0, removedItem)
        return { ...cart, items: restored }
      })
      adjustCachedQuantity(queryClient, removedItem.quantity)
    }

    await options?.onError?.(error, variables, onMutateResult, context)
  },
  onSettled: async (...args) => {
    await reconcileCartWhenIdle(queryClient)
    await options?.onSettled?.(...args)
  },
})

export const useDeleteLineItem = (
  options?: UseMutationOptions<void, Error, { lineId: string }, DeleteLineItemContext>,
) => {
  const queryClient = useQueryClient()
  return useMutation(deleteLineItemMutation(queryClient, options))
}

type AddLineItemVariables = {
  variantId: string
  quantity: number
  countryCode: string | undefined
}

export const addLineItemMutation = (
  queryClient: QueryClient,
  options?: UseMutationOptions<void, Error, AddLineItemVariables, unknown>,
): UseMutationOptions<void, Error, AddLineItemVariables, unknown> => ({
  ...options,
  mutationKey: [...CART_LINE_MUTATION_KEY, "add"],
  mutationFn: (payload) => addToCart(payload),
  onSettled: async (...args) => {
    await reconcileCartWhenIdle(queryClient)
    await options?.onSettled?.(...args)
  },
})

export const useAddLineItem = (
  options?: UseMutationOptions<void, Error, AddLineItemVariables, unknown>,
) => {
  const queryClient = useQueryClient()
  return useMutation(addLineItemMutation(queryClient, options))
}

export const useSetShippingMethod = (
  { cartId }: { cartId: string },
  options?: UseMutationOptions<void, Error, { shippingMethodId: string }, unknown>,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["shipping-update", cartId],
    mutationFn: async ({ shippingMethodId }) => {
      const response = await setShippingMethod({
        cartId,
        shippingMethodId,
      })

      return response
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })
      await queryClient.invalidateQueries({
        queryKey: ["cart", cartId, "shipping-methods"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}

export const addressesFormSchema = z
  .object({
    shipping_address: z.object({
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      company: z.string().optional(),
      address_1: z.string().min(1),
      address_2: z.string().optional(),
      city: z.string().min(1),
      postal_code: z.string().min(1),
      province: z.string().trim().min(1, "Enter the state for delivery"),
      country_code: z.string().min(2),
      phone: z.string().trim().min(1, "Enter a phone number for delivery updates"),
    }),
  })
  .and(
    z.discriminatedUnion("same_as_billing", [
      z.object({
        same_as_billing: z.literal("on"),
      }),
      z.object({
        same_as_billing: z.literal("off").optional(),
        billing_address: z.object({
          first_name: z.string().min(1),
          last_name: z.string().min(1),
          company: z.string().optional(),
          address_1: z.string().min(1),
          address_2: z.string().optional(),
          city: z.string().min(1),
          postal_code: z.string().min(1),
          province: z.string().optional(),
          country_code: z.string().min(2),
          phone: z.string().optional(),
        }),
      }),
    ]),
  )

export type AddressesFormValues = z.infer<typeof addressesFormSchema>

export const useSetShippingAddress = (
  options?: UseMutationOptions<
    { success: boolean; error: string | null; countryCode?: string },
    Error,
    AddressesFormValues,
    unknown
  >,
) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["shipping-address-update"],
    mutationFn: async (payload) => {
      const response = await setAddresses(payload)
      return response
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}

export const useSetEmail = (
  options?: UseMutationOptions<
    { success: boolean; error: string | null },
    Error,
    { email: string; country_code: string },
    unknown
  >,
) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["set-email"],
    mutationFn: async (payload) => {
      const response = await setEmail(payload)
      return response
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}

export const useInitiatePaymentSession = (
  options?: UseMutationOptions<
    HttpTypes.StorePaymentCollectionResponse,
    Error,
    {
      providerId: string
    },
    unknown
  >,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["initiate-payment"],
    mutationFn: async (payload: { providerId: string }) => {
      const response = await initiatePaymentSession(payload.providerId)

      return response
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}

export const usePlaceOrder = (
  options?: UseMutationOptions<
    | {
        type: "cart"
        cart: HttpTypes.StoreCart
        error: {
          message: string
          name: string
          type: string
        }
      }
    | {
        type: "order"
        order: HttpTypes.StoreOrder
      }
    | null,
    Error,
    null,
    unknown
  >,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["place-order"],
    mutationFn: async () => {
      const response = await placeOrder()
      return response
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}

export const useApplyPromotions = (
  options?: UseMutationOptions<void, Error, string[], unknown>,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["apply-promotion"],
    mutationFn: async (payload) => {
      const response = await applyPromotions(payload)

      return response
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}

export const useUpdateRegion = (
  options?: UseMutationOptions<void, Error, { countryCode: string; currentPath: string }, unknown>,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["update-region"],
    mutationFn: async ({ countryCode, currentPath }) => {
      await updateRegion(countryCode, currentPath)
    },
    ...options,
    async onSuccess(...args) {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["cart"],
      })
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("shipping-methods"),
      })
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["regions"],
      })
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ["products"],
      })

      await options?.onSuccess?.(...args)
    },
  })
}
