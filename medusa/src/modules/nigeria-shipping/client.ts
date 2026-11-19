import { z } from "zod"
import type { ShippingContext } from "../dhl-shipping/quote"
import {
  AUTH_TTL_SECONDS,
  cacheKey,
  CarrierCache,
  GEOCODE_TTL_SECONDS,
  QUOTE_TTL_SECONDS,
} from "./cache"
import type { CarrierOptions, FezOptions, GigOptions } from "./config"

const required = z.string().trim().min(1)
const positive = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? Number(value) : value),
  z.number().positive(),
)
const addressSchema = z.object({
  country_code: z.string().toLowerCase().pipe(z.literal("ng")),
  address_1: required,
  address_2: z.string().nullish(),
  city: required,
  province: required,
  postal_code: required,
  phone: required,
})

export function stateName(value: string) {
  const state = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ state$/, "")
  return ["fct", "abuja", "abuja fct", "federal capital territory"].includes(state)
    ? "FCT"
    : state.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function domesticParcel(context: ShippingContext, packagingWeight: number) {
  if (context.currency_code !== "ngn") throw new Error("Nigeria shipping requires an NGN cart.")
  const sender = addressSchema.parse(context.from_location?.address)
  const receiver = addressSchema
    .extend({ first_name: required, last_name: required })
    .parse(context.shipping_address)
  const items = (context.items ?? []).filter((item) => item.requires_shipping !== false)
  if (!items.length) throw new Error("A physical item is required for shipping.")
  const weight =
    items.reduce(
      (sum, item) => sum + positive.parse(item.variant?.weight) * positive.parse(item.quantity),
      packagingWeight,
    ) / 1000
  const value = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
    0,
  )
  if (!Number.isFinite(value) || value < 0) throw new Error("Shipment value is unavailable.")
  return { sender, receiver, weight, value, email: context.email }
}
type Parcel = ReturnType<typeof domesticParcel>

export const parcelSettings = z.object({
  sender_name: required,
  box_weight_grams: positive,
  length_cm: positive,
  width_cm: positive,
  height_cm: positive,
  max_weight_kg: positive,
})
export type ParcelSettings = z.infer<typeof parcelSettings>

type Headers = Record<string, string>
export type CarrierQuote = {
  amount: number
  book: (orderId: string) => Promise<{ waybill: string; trackingUrl: string }>
}
type CarrierContext = {
  call: (path: string, body?: unknown) => Promise<unknown>
  rate: (path: string, body: unknown, amount: (response: unknown) => number) => Promise<number>
  cache: CarrierCache
}
type CarrierApi = {
  root: string
  login: () => Promise<Headers>
  quote: (
    parcel: Parcel,
    settings: ParcelSettings,
    context: CarrierContext,
  ) => Promise<CarrierQuote>
}

class CarrierHttpError extends Error {
  constructor(readonly status: number) {
    super(`Carrier service returned HTTP ${status}.`)
  }
}

async function request(url: string, headers: Headers, body?: unknown): Promise<unknown> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
  })
  if (!response.ok) throw new CarrierHttpError(response.status)
  return response.json() as Promise<unknown>
}

function formatted(address: Parcel["sender"]) {
  return [
    address.address_1,
    address.address_2,
    address.city,
    stateName(address.province),
    address.postal_code,
    "Nigeria",
  ]
    .filter(Boolean)
    .join(", ")
}

const recipientName = (receiver: Parcel["receiver"]) =>
  `${receiver.first_name} ${receiver.last_name}`

function fezApi({ username, password, live }: FezOptions): CarrierApi {
  const root = live ? "https://api.fezdelivery.co/v1/" : "https://apisandbox.fezdelivery.co/v1/"
  const trackingHost = live ? "https://web.fezdelivery.co" : "https://d2pqv4mo6dthx7.cloudfront.net"
  const rateSchema = z.object({ status: z.literal("Success"), totalCost: positive })
  return {
    root,
    async login() {
      const response = z
        .object({
          authDetails: z.object({ authToken: required }),
          data: z.object({ orgDetails: z.object({ "secret-key": required }) }),
        })
        .parse(await request(root + "user/authenticate", {}, { user_id: username, password }))
      return {
        Authorization: `Bearer ${response.authDetails.authToken}`,
        "secret-key": response.data.orgDetails["secret-key"],
      }
    },
    async quote(parcel, _settings, { call, rate }) {
      const { sender, receiver } = parcel
      const rateRequest = {
        state: stateName(receiver.province),
        pickUpState: stateName(sender.province),
        weight: parcel.weight,
      }
      return {
        amount: await rate("order/cost", rateRequest, (body) => rateSchema.parse(body).totalCost),
        book: async (orderId) => {
          const { orderNos } = z.object({ orderNos: z.record(z.string(), required) }).parse(
            await call("order", [
              {
                recipientAddress: formatted(receiver),
                recipientState: rateRequest.state,
                recipientName: recipientName(receiver),
                recipientPhone: receiver.phone,
                recipientEmail: z.email().parse(parcel.email),
                uniqueID: orderId,
                BatchID: orderId,
                valueOfItem: parcel.value,
                weight: parcel.weight,
                pickUpState: rateRequest.pickUpState,
                itemDescription: `YourNextHair order ${orderId}`,
                orderRequestSource: "YourNextHair",
              },
            ]),
          )
          const waybill = required.parse(orderNos[orderId])
          return {
            waybill,
            trackingUrl: `${trackingHost}/track-delivery/${encodeURIComponent(waybill)}`,
          }
        },
      }
    },
  }
}

const coordinateSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
        }),
        properties: z.object({
          country_code: z.literal("ng"),
          result_type: z.enum(["building", "street", "amenity"]),
        }),
      }),
    )
    .min(1),
})

function gigApi({ username, password, live, geoapifyKey }: GigOptions): CarrierApi {
  const root = live
    ? "https://thirdpartynode.theagilitysystems.com/"
    : "https://dev-thirdpartynode.theagilitysystems.com/"
  const priceSchema = z.object({ data: z.object({ GrandTotal: positive }) })
  const geocode = (address: string, cache: CarrierCache) =>
    cache.remember(cacheKey("geocode", address), GEOCODE_TTL_SECONDS, async () => {
      const params = new URLSearchParams({
        text: address,
        filter: "countrycode:ng",
        limit: "1",
        apiKey: geoapifyKey,
      })
      const response = coordinateSchema.parse(
        await request(`https://api.geoapify.com/v1/geocode/search?${params}`, {}),
      )
      const [longitude, latitude] = response.features[0]!.geometry.coordinates
      return { Latitude: String(latitude), Longitude: String(longitude) }
    })
  return {
    root,
    async login() {
      const response = z
        .object({ data: z.object({ "access-token": required }) })
        .parse(await request(root + "login", {}, { email: username, password }))
      return { "access-token": response.data["access-token"] }
    },
    async quote(parcel, settings, { call, rate, cache }) {
      const { sender, receiver } = parcel
      const senderAddress = formatted(sender)
      const receiverAddress = formatted(receiver)
      const [SenderLocation, ReceiverLocation] = await Promise.all([
        geocode(senderAddress, cache),
        geocode(receiverAddress, cache),
      ])
      const shipmentItem = {
        Description: "Hair products",
        ItemName: "Hair products",
        ShipmentType: 1,
        Quantity: 1,
        Weight: parcel.weight,
        IsVolumetric: false,
        Value: parcel.value,
        SpecialPackageId: 0,
        Length: settings.length_cm,
        Width: settings.width_cm,
        Height: settings.height_cm,
      }
      const priceRequest = {
        ShipmentItems: [shipmentItem],
        SenderLocation,
        ReceiverLocation,
        VehicleType: 1,
        IsPriorityShipment: false,
        PickUpOptions: 1,
      }
      return {
        amount: await rate(
          "price/v3",
          priceRequest,
          (body) => priceSchema.parse(body).data.GrandTotal,
        ),
        book: async (orderId) => {
          const result = z.object({ data: z.object({ Waybill: required }) }).parse(
            await call("capture/preshipment", {
              ShipmentItems: [{ ...shipmentItem, Description: `YourNextHair order ${orderId}` }],
              ShipmentDetails: { VehicleType: 1, IsBatchPickUp: 1, IsFromAgility: 0 },
              SenderDetails: {
                SenderName: settings.sender_name,
                SenderPhoneNumber: sender.phone,
                SenderAddress: senderAddress,
                InputtedSenderAddress: senderAddress,
                SenderLocality: sender.city,
                SenderLocation: { ...SenderLocation, FormattedAddress: "", Name: "", LGA: "" },
              },
              ReceiverDetails: {
                ReceiverName: recipientName(receiver),
                ReceiverPhoneNumber: receiver.phone,
                ReceiverAddress: receiverAddress,
                InputtedReceiverAddress: receiverAddress,
                ReceiverLocation: { ...ReceiverLocation, FormattedAddress: "", Name: "", LGA: "" },
              },
            }),
          )
          const waybill = result.data.Waybill
          return {
            waybill,
            trackingUrl: `https://giglogistics.com/track-shipment/?waybill=${encodeURIComponent(waybill)}`,
          }
        },
      }
    },
  }
}

// Carrier tokens grant API access, so they stay in process memory and never reach the shared cache.
const processTokens = new CarrierCache()

export class NigeriaCarrier {
  private readonly api: CarrierApi
  private readonly authKey: string

  constructor(
    options: CarrierOptions,
    private readonly cache = new CarrierCache(),
    private readonly tokens = processTokens,
  ) {
    this.api = options.carrier === "fez" ? fezApi(options) : gigApi(options)
    this.authKey = cacheKey("auth", this.api.root, options.username)
  }

  private headers() {
    return this.tokens.remember(this.authKey, AUTH_TTL_SECONDS, () => this.api.login())
  }

  private async call(path: string, body?: unknown) {
    try {
      return await request(this.api.root + path, await this.headers(), body)
    } catch (error) {
      if (!(error instanceof CarrierHttpError) || (error.status !== 401 && error.status !== 403))
        throw error
      await this.tokens.forget(this.authKey)
      return request(this.api.root + path, await this.headers(), body)
    }
  }

  async quote(parcel: Parcel, settings: ParcelSettings, { fresh = false } = {}) {
    if (parcel.weight > settings.max_weight_kg)
      throw new Error("Parcel exceeds the configured shipping weight.")
    const rate: CarrierContext["rate"] = async (path, body, amount) => {
      const load = async () => ({ amount: amount(await this.call(path, body)) })
      if (fresh) return (await load()).amount
      const key = cacheKey("quote", this.api.root + path, JSON.stringify(body))
      return (await this.cache.remember(key, QUOTE_TTL_SECONDS, load)).amount
    }
    return this.api.quote(parcel, settings, {
      call: (path, body) => this.call(path, body),
      rate,
      cache: this.cache,
    })
  }
}
