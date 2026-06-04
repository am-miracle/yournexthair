"use client"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { useCart } from "@/hooks/cart"
import SkeletonCheckoutSummary from "@modules/skeletons/templates/skeleton-checkout-summary"

function CheckoutSummaryWrapper() {
  const { data: cart, isPending } = useCart({ enabled: true })
  if (isPending || !cart) {
    return <SkeletonCheckoutSummary />
  }

  return <CheckoutSummary cart={cart} />
}

export default CheckoutSummaryWrapper
