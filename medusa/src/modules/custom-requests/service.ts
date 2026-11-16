import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import type { z } from "zod"
import CustomRequest from "./models/custom-request"
import type { quoteUpdateSchema, Submission } from "./submission"

export default class CustomRequestsService extends MedusaService({ CustomRequest }) {
  async submit(submission: Submission) {
    const existing = await this.findBySubmissionKey(submission.submission_key)
    if (existing) {
      return { request: existing, created: false }
    }
    try {
      return { request: await this.createCustomRequests(submission), created: true }
    } catch (error) {
      // A concurrent retry with the same key won the insert; hand back its reference.
      const raced = await this.findBySubmissionKey(submission.submission_key)
      if (raced) {
        return { request: raced, created: false }
      }
      throw error
    }
  }

  async updateQuote(id: string, input: z.infer<typeof quoteUpdateSchema>) {
    const current = await this.retrieveCustomRequest(id)
    const next = {
      status: input.status ?? current.status,
      quoted_amount:
        input.quoted_amount === undefined ? current.quoted_amount : input.quoted_amount,
      quoted_currency:
        input.quoted_currency === undefined ? current.quoted_currency : input.quoted_currency,
    }
    if (next.status === "quoted" && (!(Number(next.quoted_amount) > 0) || !next.quoted_currency)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Add the quoted amount and currency before marking this request as quoted.",
      )
    }
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Partial<typeof next> & { admin_notes?: string | null }
    return this.updateCustomRequests({ id, ...changes })
  }

  private async findBySubmissionKey(submissionKey: string) {
    const [match] = await this.listCustomRequests({ submission_key: submissionKey }, { take: 1 })
    return match
  }
}
