import "server-only"
import { cookies } from "next/headers"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  const token = (await cookies()).get("_medusa_jwt")?.value

  if (token) {
    return { authorization: `Bearer ${token}` }
  }

  return {}
}

export const setAuthToken = async (token: string) => {
  return (await cookies()).set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  return (await cookies()).set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  return (await cookies()).get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  return (await cookies()).set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  return (await cookies()).set("_medusa_cart_id", "", { maxAge: -1 })
}

const ORDER_ACCESS_COOKIE = "_medusa_order_access"

export const getOrderAccessIds = async () => {
  return ((await cookies()).get(ORDER_ACCESS_COOKIE)?.value ?? "").split(",").filter(Boolean)
}

export const rememberOrderAccess = async (orderId: string) => {
  const ids = [orderId, ...(await getOrderAccessIds()).filter((id) => id !== orderId)].slice(0, 5)
  return (await cookies()).set(ORDER_ACCESS_COOKIE, ids.join(","), {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}
