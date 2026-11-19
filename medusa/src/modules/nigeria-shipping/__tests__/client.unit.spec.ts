import { CarrierCache, type CacheStore, memoryStore } from "../cache"
import type { CarrierOptions } from "../config"
import { domesticParcel, NigeriaCarrier, parcelSettings, stateName } from "../client"

const address = {
  country_code: "ng",
  address_1: "1 Main Street",
  city: "Ikeja",
  province: "lagos",
  postal_code: "100001",
  phone: "08000000000",
}
const settings = parcelSettings.parse({
  sender_name: "Dispatch",
  box_weight_grams: 100,
  length_cm: 30,
  width_cm: 25,
  height_cm: 10,
  max_weight_kg: 2,
})
const context = {
  currency_code: "ngn",
  email: "test@example.com",
  from_location: { address },
  shipping_address: { ...address, first_name: "Ada", last_name: "Jones", province: "fct" },
  items: [{ variant: { weight: 200 }, quantity: 2, unit_price: 5000 }],
}
const credentials = {
  username: "merchant",
  password: "test-password",
  live: false,
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const geocode = () =>
  json({
    features: [
      {
        geometry: { coordinates: [3.3, 6.5] },
        properties: { country_code: "ng", result_type: "street" },
      },
    ],
  })
const fezLogin = (token = "test-token") =>
  json({
    authDetails: { authToken: token },
    data: { orgDetails: { "secret-key": "test-secret" } },
  })
const carrier = (options: CarrierOptions, cache = new CarrierCache()) =>
  new NigeriaCarrier(options, cache, new CarrierCache())
const urls = () => request.mock.calls.map(([url]) => String(url))
const request = jest.spyOn(global, "fetch")
afterEach(() => request.mockReset())
afterAll(() => request.mockRestore())

it("quotes FEZ separately from booking and maps the response by merchant order ID", async () => {
  request
    .mockResolvedValueOnce(
      json({
        authDetails: { authToken: "test-token" },
        data: { orgDetails: { "secret-key": "test-secret" } },
      }),
    )
    .mockResolvedValueOnce(json({ status: "Success", totalCost: "4200" }))
    .mockResolvedValueOnce(json({ orderNos: { order_1: "FEZ123" } }))
  const client = carrier({ ...credentials, carrier: "fez" })
  const quote = await client.quote(domesticParcel(context, settings.box_weight_grams), settings)
  expect(quote.amount).toBe(4200)
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1]?.[1]?.body).toBe(
    JSON.stringify({
      state: "FCT",
      pickUpState: "Lagos",
      weight: 0.5,
    }),
  )
  await expect(quote.book("order_1")).resolves.toMatchObject({ waybill: "FEZ123" })
  expect(request.mock.calls[2]?.[1]?.body).toContain('"uniqueID":"order_1"')
})

it("quotes GIG with geocoded addresses and books the selected prepaid parcel", async () => {
  request
    .mockResolvedValueOnce(geocode())
    .mockResolvedValueOnce(geocode())
    .mockResolvedValueOnce(json({ data: { "access-token": "test-token" } }))
    .mockResolvedValueOnce(json({ data: { GrandTotal: 4500 } }))
    .mockResolvedValueOnce(json({ data: { Waybill: "GIG123" } }))
  const client = carrier({ ...credentials, carrier: "gig", geoapifyKey: "test-key" })
  const quote = await client.quote(domesticParcel(context, settings.box_weight_grams), settings)
  expect(quote.amount).toBe(4500)
  expect(request.mock.calls[3]?.[0]).toBe(
    "https://dev-thirdpartynode.theagilitysystems.com/price/v3",
  )
  expect(request.mock.calls[3]?.[1]?.body).toContain('"Weight":0.5')
  await expect(quote.book("order_1")).resolves.toEqual({
    waybill: "GIG123",
    trackingUrl: "https://giglogistics.com/track-shipment/?waybill=GIG123",
  })
  expect(request.mock.calls[4]?.[0]).toBe(
    "https://dev-thirdpartynode.theagilitysystems.com/capture/preshipment",
  )
  expect(request.mock.calls[4]?.[1]?.body).not.toContain("CashOnDelivery")
  expect(request.mock.calls[4]?.[1]?.body).toContain("YourNextHair order order_1")
})

it("rejects a non-NGN cart before contacting a local courier", () => {
  expect(() => domesticParcel({ ...context, currency_code: "usd" }, 100)).toThrow("NGN")
  expect(request).not.toHaveBeenCalled()
})

it.each([
  ["fct", "FCT"],
  ["Abuja FCT", "FCT"],
  ["Federal Capital Territory", "FCT"],
  ["akwa ibom", "Akwa Ibom"],
  ["Lagos State", "Lagos"],
])("normalises %s to the carrier state name %s", (input, expected) => {
  expect(stateName(input)).toBe(expected)
})

describe("caching", () => {
  const parcel = () => domesticParcel(context, settings.box_weight_grams)

  it("reuses the login token and the checkout quote for identical parcels", async () => {
    request
      .mockResolvedValueOnce(fezLogin())
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4200 }))
    const client = carrier({ ...credentials, carrier: "fez" })
    await client.quote(parcel(), settings)
    await expect(client.quote(parcel(), settings)).resolves.toMatchObject({ amount: 4200 })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it("re-quotes a changed parcel without logging in again", async () => {
    request
      .mockResolvedValueOnce(fezLogin())
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4200 }))
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 5100 }))
    const client = carrier({ ...credentials, carrier: "fez" })
    await client.quote(parcel(), settings)
    const heavier = domesticParcel(context, 900)
    await expect(client.quote(heavier, settings)).resolves.toMatchObject({ amount: 5100 })
    expect(urls().filter((url) => url.endsWith("user/authenticate"))).toHaveLength(1)
  })

  it("fetches a fresh price for dispatch even when a checkout quote is cached", async () => {
    request
      .mockResolvedValueOnce(fezLogin())
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4200 }))
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4800 }))
    const client = carrier({ ...credentials, carrier: "fez" })
    await client.quote(parcel(), settings)
    await expect(client.quote(parcel(), settings, { fresh: true })).resolves.toMatchObject({
      amount: 4800,
    })
  })

  it("logs in again once when the cached token is rejected", async () => {
    request
      .mockResolvedValueOnce(fezLogin("expired"))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(fezLogin("renewed"))
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4200 }))
    const client = carrier({ ...credentials, carrier: "fez" })
    await expect(client.quote(parcel(), settings)).resolves.toMatchObject({ amount: 4200 })
    const retried = request.mock.calls[3]?.[1]?.headers as Record<string, string>
    expect(retried.Authorization).toBe("Bearer renewed")
  })

  it("geocodes each GIG address once across quotes", async () => {
    request
      .mockResolvedValueOnce(geocode())
      .mockResolvedValueOnce(geocode())
      .mockResolvedValueOnce(json({ data: { "access-token": "test-token" } }))
      .mockResolvedValueOnce(json({ data: { GrandTotal: 4500 } }))
      .mockResolvedValueOnce(json({ data: { GrandTotal: 4700 } }))
    const client = carrier({ ...credentials, carrier: "gig", geoapifyKey: "test-key" })
    await client.quote(parcel(), settings)
    await client.quote(parcel(), settings, { fresh: true })
    expect(urls().filter((url) => url.includes("geoapify"))).toHaveLength(2)
  })

  it("keeps carrier tokens out of the shared cache", async () => {
    const shared = memoryStore()
    const written: string[] = []
    const recording: CacheStore = {
      ...shared,
      set: (key, value, ttl) => {
        written.push(JSON.stringify(value))
        return shared.set(key, value, ttl)
      },
    }
    request
      .mockResolvedValueOnce(fezLogin("secret-token"))
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4200 }))
    await carrier({ ...credentials, carrier: "fez" }, new CarrierCache(recording)).quote(
      parcel(),
      settings,
    )
    expect(written).toEqual([JSON.stringify({ amount: 4200 })])
  })

  it("quotes normally when the cache store is unavailable", async () => {
    const broken: CacheStore = {
      get: () => Promise.reject(new Error("redis down")),
      set: () => Promise.reject(new Error("redis down")),
      clear: () => Promise.reject(new Error("redis down")),
    }
    const errors: string[] = []
    request
      .mockResolvedValueOnce(fezLogin())
      .mockResolvedValueOnce(json({ status: "Success", totalCost: 4200 }))
    const client = carrier(
      { ...credentials, carrier: "fez" },
      new CarrierCache(broken, (message) => errors.push(message)),
    )
    await expect(client.quote(parcel(), settings)).resolves.toMatchObject({ amount: 4200 })
    expect(errors[0]).toContain("redis down")
  })
})
