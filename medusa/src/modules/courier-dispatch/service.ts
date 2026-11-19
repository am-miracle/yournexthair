import { MedusaService } from "@medusajs/framework/utils"
import CourierDispatch from "./models/courier-dispatch"
import { type DispatchState, HOLD_MINUTES, MAX_ATTEMPTS, retryDelayMinutes } from "./plan"

type DispatchUpdate = Partial<{
  state: DispatchState
  carrier: string
  environment: string
  fulfillment_id: string
  waybill: string
  tracking_url: string
  attempts: number
  last_error: string | null
  next_attempt_at: Date
}>

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000)

export default class CourierDispatchService extends MedusaService({ CourierDispatch }) {
  async find(order_id: string) {
    const [row] = await this.listCourierDispatches({ order_id }, { take: 1 })
    return row
  }

  async enqueue(order_id: string) {
    if (await this.find(order_id)) return
    try {
      await this.createCourierDispatches({ order_id, next_attempt_at: new Date() })
    } catch (error) {
      if (!(await this.find(order_id))) throw error
    }
  }

  listDue(take: number) {
    return this.listCourierDispatches(
      { state: ["pending", "booked"], next_attempt_at: { $lte: new Date() } },
      { order: { next_attempt_at: "ASC" }, take },
    )
  }

  async transition(order_id: string, from: DispatchState, data: DispatchUpdate) {
    const updated = await this.updateCourierDispatches({
      selector: { order_id, state: from },
      data: { last_error: null, ...data },
    })
    if (updated.length !== 1) throw new Error("Courier dispatch changed concurrently.")
  }

  hold(order_id: string, reason: string) {
    return this.transition(order_id, "pending", {
      last_error: reason,
      next_attempt_at: minutesFromNow(HOLD_MINUTES),
    })
  }

  fail(order_id: string, reason: string) {
    return this.transition(order_id, "pending", { state: "failed", last_error: reason })
  }

  async recordError(order_id: string, message: string): Promise<DispatchState | undefined> {
    const row = await this.find(order_id)
    if (!row) return undefined
    if (row.state !== "pending" && row.state !== "booked") {
      await this.updateCourierDispatches({ id: row.id, last_error: message })
      return row.state
    }
    const attempts = row.attempts + 1
    const state = attempts >= MAX_ATTEMPTS ? "failed" : row.state
    await this.updateCourierDispatches({
      id: row.id,
      state,
      attempts,
      last_error: message,
      next_attempt_at: minutesFromNow(retryDelayMinutes(attempts)),
    })
    return state
  }
}
