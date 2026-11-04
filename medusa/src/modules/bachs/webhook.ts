import { createHmac, timingSafeEqual } from "crypto"

export const SIGNATURE_TOLERANCE_SECONDS = 300

type Headers = Record<string, string | string[] | undefined>

const headerValue = (headers: Headers, name: string): string | undefined => {
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

// The payment webhook payload crosses the event bus, so a Buffer may arrive
// JSON-serialised as { type: "Buffer", data: number[] }.
export const toRawBody = (rawData: unknown): Buffer | null => {
  if (Buffer.isBuffer(rawData)) {
    return rawData
  }

  if (typeof rawData === "string") {
    return Buffer.from(rawData, "utf8")
  }

  if (
    typeof rawData === "object" &&
    rawData !== null &&
    (rawData as { type?: unknown }).type === "Buffer" &&
    Array.isArray((rawData as { data?: unknown }).data)
  ) {
    return Buffer.from((rawData as { data: number[] }).data)
  }

  return null
}

export const computeSignature = (timestamp: string, rawBody: Buffer, secret: string) =>
  createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]))
    .digest("hex")

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

const parseV2Header = (header: string) => {
  let timestamp: string | undefined
  const signatures: string[] = []

  for (const part of header.split(",")) {
    const index = part.indexOf("=")
    if (index === -1) {
      continue
    }

    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()

    if (key === "t") {
      timestamp = value
    } else if (key === "v1") {
      signatures.push(value)
    }
  }

  return { timestamp, signatures }
}

export const verifyBachsSignature = (
  rawBody: Buffer,
  headers: Headers,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): boolean => {
  const v2 = headerValue(headers, "x-bachs-signature-v2")
  let timestamp: string | undefined
  let signatures: string[]

  if (v2) {
    ;({ timestamp, signatures } = parseV2Header(v2))
  } else {
    timestamp = headerValue(headers, "x-bachs-timestamp")
    const legacy = headerValue(headers, "x-bachs-signature")
    signatures = legacy ? [legacy.trim()] : []
  }

  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) {
    return false
  }

  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) {
    return false
  }

  const expected = computeSignature(timestamp, rawBody, secret)
  return signatures.some((signature) => safeEqual(expected, signature))
}
