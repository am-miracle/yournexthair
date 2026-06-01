import { z } from "zod"

export const collectionMetadataCustomFieldsSchema = z.object({
  image: z
    .object({
      id: z.string(),
      url: z.url(),
    })
    .optional(),
  description: z.string().optional(),
  collection_page_image: z
    .object({
      id: z.string(),
      url: z.url(),
    })
    .optional(),
  collection_page_heading: z.string().optional(),
  collection_page_content: z.string().optional(),
  product_page_heading: z.string().optional(),
  product_page_image: z
    .object({
      id: z.string(),
      url: z.url(),
    })
    .optional(),
  product_page_wide_image: z
    .object({
      id: z.string(),
      url: z.url(),
    })
    .optional(),
  product_page_cta_image: z
    .object({
      id: z.string(),
      url: z.url(),
    })
    .optional(),
  product_page_cta_heading: z.string().optional(),
  product_page_cta_link: z.string().optional(),
})
