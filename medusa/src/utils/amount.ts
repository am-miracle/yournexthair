import { MathBN } from "@medusajs/framework/utils"

type BigNumberInput = Parameters<typeof MathBN.convert>[0]

export function toAmount(value: unknown) {
  try {
    return MathBN.convert(value as BigNumberInput).toNumber()
  } catch {
    return Number.NaN
  }
}
