import { revalidatePath, revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

import { PRODUCTS_CACHE_TAG } from "@lib/data/cache"

const parseTags = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === "string")
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  return []
}

const isAuthorized = (request: NextRequest) => {
  const expectedSecret = process.env.STOREFRONT_REVALIDATE_SECRET

  if (!expectedSecret) {
    console.error("STOREFRONT_REVALIDATE_SECRET is not configured.")
    return false
  }

  const authHeader = request.headers.get("authorization")

  return authHeader === `Bearer ${expectedSecret}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const tags = parseTags(body?.tags)

  if (!tags.length) {
    return NextResponse.json({ error: "No tags provided" }, { status: 400 })
  }

  for (const tag of tags) {
    revalidateTag(tag, "max")

    if (tag === PRODUCTS_CACHE_TAG) {
      revalidatePath("/[countryCode]/(main)/store", "page")
      revalidatePath("/[countryCode]/(main)/products/[handle]", "page")
      revalidatePath("/[countryCode]/(main)/collections/[handle]", "page")
    }
  }

  return NextResponse.json({ revalidated: true, tags })
}
