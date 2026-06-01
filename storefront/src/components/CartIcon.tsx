import { Suspense } from "react"
import { getCartQuantity } from "@lib/data/cart"
import { Icon, IconProps } from "@/components/Icon"
import { withConditionalProp } from "@lib/util/optional-props"

const CartIconWithQuantity: React.FC<
  Omit<IconProps, "status" | "name">
> = async (props) => {
  const quantity = await getCartQuantity()

  return (
    <Icon
      name="case"
      {...withConditionalProp(quantity > 0, "status", quantity)}
      {...props}
    />
  )
}

export const CartIcon: React.FC<Omit<IconProps, "status" | "name">> = (
  props
) => {
  return (
    <Suspense fallback={<Icon name="case" {...props} />}>
      <CartIconWithQuantity {...props} />
    </Suspense>
  )
}
