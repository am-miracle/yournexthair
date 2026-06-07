"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { Drawer } from "@/components/Drawer"
import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"
import { useCartQuantity } from "@/hooks/cart"

const CartDrawerContent = dynamic(() => import("@/components/CartDrawerContent"), {
  loading: () => (
    <div className="flex align-middle justify-around items-center h-screen ">
      <Icon name="loader" className="w-10 md:w-15 animate-spin" />
    </div>
  ),
})

export const CartDrawer = () => {
  const [isCartDrawerOpen, setIsCartDrawerOpen] = React.useState(false)
  const { data: quantity, isPending: pendingQuantity } = useCartQuantity()

  return (
    <>
      <Button
        onPress={() => setIsCartDrawerOpen(true)}
        variant="ghost"
        className="h-10 w-10 rounded-full p-0 transition-colors hover:bg-black/5 group-data-[light=true]:md:text-white group-data-[light=true]:md:hover:bg-white/15 group-data-[sticky=true]:md:text-black! group-data-[sticky=true]:md:hover:bg-black/5"
        aria-label="Open cart"
      >
        {pendingQuantity ? (
          <Icon name="case" className=" w-6 h-6" />
        ) : (
          <Icon
            name="case"
            className=" w-6 h-6"
            {...(quantity && quantity > 0 ? { status: quantity } : {})}
          />
        )}
      </Button>
      <Drawer
        aria-label="Shopping cart"
        colorScheme="light"
        animateFrom="right"
        isOpen={isCartDrawerOpen}
        onOpenChange={setIsCartDrawerOpen}
        className="max-sm:max-w-100 max-w-139 max-sm:px-6 px-12 pt-10"
      >
        {({ close }) => (
          <>
            <div className="flex justify-between mb-2">
              <div>
                <p className="text-md">Cart</p>
              </div>
              <Button variant="ghost" onPress={close} aria-label="Close cart" className="p-0">
                <Icon name="close" className="w-6" />
              </Button>
            </div>
            {isCartDrawerOpen ? <CartDrawerContent onClose={close} /> : null}
          </>
        )}
      </Drawer>
    </>
  )
}
