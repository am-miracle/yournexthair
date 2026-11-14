import { z } from "zod"

export const documentSchema = z.object({
  imageFormat: z.string(),
  content: z.string(),
  typeCode: z.string().optional(),
})

export const documentsSchema = z.array(documentSchema)
