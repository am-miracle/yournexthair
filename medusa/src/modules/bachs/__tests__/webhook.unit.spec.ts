import { computeSignature, toRawBody, verifyBachsSignature } from "../webhook"

const secret = "whsec_test"
const body = Buffer.from('{"id":"evt_1","type":"collection.succeeded","data":{}}')
const now = 1_800_000_000
const ts = String(now)

describe("verifyBachsSignature", () => {
  it("accepts a valid V2 header with any matching v1 signature", () => {
    const header = `t=${ts},v1=${computeSignature(ts, body, "whsec_old")},v1=${computeSignature(ts, body, secret)}`

    expect(verifyBachsSignature(body, { "x-bachs-signature-v2": header }, secret, now)).toBe(true)
  })

  it("falls back to the legacy signature and timestamp headers", () => {
    const headers = {
      "x-bachs-timestamp": ts,
      "x-bachs-signature": computeSignature(ts, body, secret),
    }

    expect(verifyBachsSignature(body, headers, secret, now)).toBe(true)
  })

  it("rejects a tampered body", () => {
    const header = `t=${ts},v1=${computeSignature(ts, body, secret)}`
    const tampered = Buffer.from(body.toString().replace("evt_1", "evt_2"))

    expect(verifyBachsSignature(tampered, { "x-bachs-signature-v2": header }, secret, now)).toBe(false)
  })

  it("rejects stale timestamps", () => {
    const header = `t=${ts},v1=${computeSignature(ts, body, secret)}`

    expect(verifyBachsSignature(body, { "x-bachs-signature-v2": header }, secret, now + 301)).toBe(false)
  })

  it("rejects deliveries without signature headers", () => {
    expect(verifyBachsSignature(body, {}, secret, now)).toBe(false)
  })
})

describe("toRawBody", () => {
  it("restores a Buffer serialised through the event bus", () => {
    const serialised: unknown = JSON.parse(JSON.stringify(body))

    expect(toRawBody(serialised)?.equals(body)).toBe(true)
  })

  it("returns null for unusable input", () => {
    expect(toRawBody(undefined)).toBeNull()
  })
})
