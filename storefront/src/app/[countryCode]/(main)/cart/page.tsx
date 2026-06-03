import { Metadata } from "next"
import CartTemplate from "@modules/cart/templates"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
  robots: {
    index: false,
    follow: false,
  },
}
export default  function Cart() {

  return <CartTemplate  />
}
