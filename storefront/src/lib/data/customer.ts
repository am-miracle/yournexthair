"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import type { AuthLoginResponse } from "@medusajs/js-sdk"

import { sdk } from "@lib/config"
import {
  getAuthHeaders,
  setAuthToken,
  removeAuthToken,
  getCartId,
} from "@lib/data/cookies"
import {
  customerAddressSchema,
  loginFormSchema,
  signupFormSchema,
  updateCustomerFormSchema,
} from "@/hooks/customer"

const normalizePhone = (phone: string | null | undefined): string | null =>
  phone?.trim() ? phone : null

const getAuthToken = (
  response: AuthLoginResponse
): string | null => (typeof response === "string" ? response : null)

const hasLocation = (
  response: AuthLoginResponse
): response is Extract<AuthLoginResponse, { location: string }> =>
  typeof response === "object" &&
  response !== null &&
  "location" in response &&
  typeof response.location === "string"

const normalizeCustomerAddress = (
  formData: z.infer<typeof customerAddressSchema>
): HttpTypes.StoreAddAddress => ({
  first_name: formData.first_name,
  last_name: formData.last_name,
  address_1: formData.address_1,
  city: formData.city,
  postal_code: formData.postal_code,
  country_code: formData.country_code,
  company: formData.company?.trim() ? formData.company : null,
  address_2: formData.address_2?.trim() ? formData.address_2 : null,
  province: formData.province?.trim() ? formData.province : null,
  phone: normalizePhone(formData.phone),
})

export const getCustomer = async function () {
  return await sdk.client
    .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
      next: { tags: ["customer"] },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(({ customer }) => customer)
    .catch(() => null)
}

export const updateCustomer = async function (
  formData: z.infer<typeof updateCustomerFormSchema>
): Promise<
  { state: "initial" | "success" } | { state: "error"; error: string }
> {
  return sdk.store.customer
    .update(
      {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: normalizePhone(formData.phone),
      },
      {},
      await getAuthHeaders()
    )
    .then(() => {
      return {
        state: "success" as const,
      }
    })
    .catch(() => {
      return {
        state: "error" as const,
        error: "Failed to update customer personal information",
      }
    })
}

export async function signup(formData: z.infer<typeof signupFormSchema>) {
  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: formData.email,
      password: formData.password,
    })

    const customHeaders = { authorization: `Bearer ${token}` }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: normalizePhone(formData.phone),
      },
      {},
      customHeaders
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: formData.email,
      password: formData.password,
    })

    if (hasLocation(loginToken)) {
      redirect(loginToken.location)

      return { success: true, customer: createdCustomer }
    }

    const authToken = getAuthToken(loginToken)
    if (!authToken) {
      return {
        success: false,
        error: "Additional authentication is required to complete sign up",
      }
    }

    await setAuthToken(authToken)

    await sdk.client.fetch("/store/custom/customer/send-welcome-email", {
      method: "POST",
      headers: await getAuthHeaders(),
    })

    const cartId = await getCartId()
    if (cartId) {
      await sdk.store.cart.transferCart(cartId, {}, await getAuthHeaders())
    }

    return { success: true, customer: createdCustomer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `${error}`,
    }
  }
}

export async function login(formData: z.infer<typeof loginFormSchema>) {
  const redirectUrl = formData.redirect_url

  try {
    const token = await sdk.auth.login("customer", "emailpass", {
      email: formData.email,
      password: formData.password,
    })

    if (hasLocation(token)) {
      return { success: true, redirectUrl: token.location }
    }

    const authToken = getAuthToken(token)
    if (!authToken) {
      return {
        success: false,
        message: "Additional authentication is required to complete login",
      }
    }

    await setAuthToken(authToken)

    const cartId = await getCartId()
    if (cartId) {
      await sdk.store.cart.transferCart(cartId, {}, await getAuthHeaders())
    }
    return { success: true, redirectUrl: redirectUrl || "/" }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : `${error}`,
    }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()
  await removeAuthToken()
  return countryCode
}

export const addCustomerAddress = async (
  formData: z.infer<typeof customerAddressSchema>
) => {
  return sdk.store.customer
    .createAddress(
      normalizeCustomerAddress(formData),
      {},
      await getAuthHeaders()
    )
    .then(({ customer }) => {
      const createdAddress = customer.addresses.at(-1)

      if (!createdAddress?.id) {
        return {
          addressId: "",
          success: false,
          error: "Failed to determine created customer address",
        }
      }

      return {
        addressId: createdAddress.id,
        success: true,
        error: null,
      }
    })
    .catch((err) => {
      return { addressId: "", success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: unknown
): Promise<void> => {
  if (typeof addressId !== "string") {
    throw new Error("Invalid input data")
  }

  await sdk.store.customer
    .deleteAddress(addressId, await getAuthHeaders())
    .then(() => {
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  addressId: string,
  formData: z.infer<typeof customerAddressSchema>
) => {
  if (!addressId) {
    throw new Error("Invalid input data")
  }

  return sdk.store.customer
    .updateAddress(
      addressId,
      normalizeCustomerAddress(formData),
      {},
      await getAuthHeaders()
    )
    .then(() => {
      return { addressId, success: true, error: null }
    })
    .catch((err) => {
      return { addressId, success: false, error: err.toString() }
    })
}

export async function requestPasswordReset() {
  const customer = await getCustomer()

  if (!customer) {
    return {
      success: false as const,
      error: "No customer found",
    }
  }
  await sdk.auth.resetPassword("logged-in-customer", "emailpass", {
    identifier: customer.email,
  })

  return {
    success: true as const,
  }
}

const resetPasswordStateSchema = z.object({
  email: z.string().email(),
  token: z.string(),
})

const resetPasswordFormSchema = z.object({
  type: z.literal("reset"),
  current_password: z.string().min(6),
  new_password: z.string().min(6),
  confirm_new_password: z.string().min(6),
})

const forgotPasswordSchema = z.object({
  type: z.literal("forgot"),
  new_password: z.string().min(6),
  confirm_new_password: z.string().min(6),
})
const baseSchema = z.discriminatedUnion("type", [
  resetPasswordFormSchema,
  forgotPasswordSchema,
])

export async function resetPassword(
  currentState: unknown,
  formData: z.infer<typeof baseSchema>
): Promise<
  z.infer<typeof resetPasswordStateSchema> &
    ({ state: "initial" | "success" } | { state: "error"; error: string })
> {
  const validatedState = resetPasswordStateSchema.parse(currentState)
  if (formData.type === "reset") {
    try {
      await sdk.auth.login("customer", "emailpass", {
        email: validatedState.email,
        password: formData.current_password,
      })
    } catch (error) {
      return {
        ...validatedState,
        state: "error" as const,
        error: "Wrong password",
      }
    }
  }
  return sdk.auth
    .updateProvider(
      formData.type === "reset" ? "logged-in-customer" : "customer",
      "emailpass",
      {
        email: validatedState.email,
        password: formData.new_password,
      },
      validatedState.token
    )
    .then(() => {
      return {
        ...validatedState,
        state: "success" as const,
      }
    })
    .catch(() => {
      return {
        ...validatedState,
        state: "error" as const,
        error: "Failed to update password",
      }
    })
}

const forgotPasswordFormSchema = z.object({
  email: z.string().email(),
})

export async function forgotPassword(
  _currentState: unknown,
  formData: z.infer<typeof forgotPasswordFormSchema>
): Promise<
  { state: "initial" | "success" } | { state: "error"; error: string }
> {
  return sdk.auth
    .resetPassword("customer", "emailpass", {
      identifier: formData.email,
    })
    .then(() => {
      return {
        state: "success" as const,
      }
    })
    .catch(() => {
      return {
        state: "error" as const,
        error: "Failed to reset password",
      }
    })
}

export async function updateDefaultShippingAddress(addressId: string) {
  if (!addressId) {
    return { success: false, error: "No address id provided" }
  }

  return sdk.store.customer
    .updateAddress(
      addressId,
      {
        is_default_shipping: true,
      },
      {},
      await getAuthHeaders()
    )
    .then(() => {
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export async function updateDefaultBillingAddress(addressId: string) {
  if (!addressId) {
    return { success: false, error: "No address id provided" }
  }

  return sdk.store.customer
    .updateAddress(
      addressId,
      {
        is_default_billing: true,
      },
      {},
      await getAuthHeaders()
    )
    .then(() => {
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}
