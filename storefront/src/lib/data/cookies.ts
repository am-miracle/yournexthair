import "server-only"
import { cookies } from "next/headers"
import { signCartCookie, verifyCartCookie } from "@lib/util/checkout-key"

export const getAuthHeaders = async (): Promise<{ authorization: string } | {}> => {
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
  return verifyCartCookie((await cookies()).get("_medusa_cart_id")?.value)
}

export const setCartId = async (cartId: string) => {
  return (await cookies()).set("_medusa_cart_id", signCartCookie(cartId), {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  return (await cookies()).set("_medusa_cart_id", "", { maxAge: -1 })
}

const ORDER_ACCESS_COOKIE = "_medusa_receipt_tokens"

type ReceiptCredential = { orderId: string; token: string }

async function getReceiptCredentials(): Promise<ReceiptCredential[]> {
  try {
    const value: unknown = JSON.parse((await cookies()).get(ORDER_ACCESS_COOKIE)?.value ?? "[]")
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (entry): entry is ReceiptCredential =>
          entry && typeof entry.orderId === "string" && typeof entry.token === "string",
      )
      .slice(0, 5)
  } catch {
    return []
  }
}

export const getReceiptHeaders = async (orderId: string) => {
  const credential = (await getReceiptCredentials()).find((entry) => entry.orderId === orderId)
  return credential ? { "x-receipt-token": credential.token } : {}
}

export const rememberOrderAccess = async (orderId: string, token: string) => {
  const credentials = [
    { orderId, token },
    ...(await getReceiptCredentials()).filter((entry) => entry.orderId !== orderId),
  ].slice(0, 5)
  return (await cookies()).set(ORDER_ACCESS_COOKIE, JSON.stringify(credentials), {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}
