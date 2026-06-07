import { GET, POST } from "../route"

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
})

const createReq = ({
  id = "prod_123",
  body = {},
  product = {},
}: {
  id?: string
  body?: Record<string, unknown>
  product?: Record<string, unknown>
} = {}) => ({
  params: { id },
  body,
  scope: {
    resolve: jest.fn().mockReturnValue({
      retrieveProduct: jest.fn().mockResolvedValue(product),
      updateProducts: jest.fn().mockResolvedValue({}),
    }),
  },
})

const wigProduct = {
  id: "prod_123",
  type: { value: "Wigs & Units" },
  metadata: {
    length_in_inches: 14,
    hair_origin: "Brazilian",
    hair_family: "Virgin",
    texture: "Body Wave",
    fulfillment_mode: "ready_to_ship",
    lace_size: "13x4",
    lace_type: "HD",
    cap_construction: "Lace Front",
  },
}

describe("GET /admin/products/:id/hair-fields", () => {
  it("returns productForm and fields for a known product type", async () => {
    const req = createReq({ product: wigProduct })
    const res = createRes()
    await GET(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    const [body] = res.json.mock.calls[0] as [
      {
        productForm: string
        fields: Array<{ field: string; rule: string; value: unknown }>
        missingRequired: string[]
      },
    ]
    expect(body.productForm).toBe("wig")
    expect(body.missingRequired).toHaveLength(0)
  })

  it("returns no hidden fields in the fields list", async () => {
    const req = createReq({ product: wigProduct })
    const res = createRes()
    await GET(req as never, res as never)

    const [body] = res.json.mock.calls[0] as [{ fields: Array<{ field: string }> }]
    const fieldNames = body.fields.map((f) => f.field)
    // bundle_deal is hidden for wigs
    expect(fieldNames).not.toContain("bundle_deal")
    expect(fieldNames).not.toContain("sample_box_flag")
  })

  it("populates current value from product metadata", async () => {
    const req = createReq({ product: wigProduct })
    const res = createRes()
    await GET(req as never, res as never)

    const [body] = res.json.mock.calls[0] as [{ fields: Array<{ field: string; value: unknown }> }]
    const lengthField = body.fields.find((f) => f.field === "length_in_inches")
    expect(lengthField?.value).toBe(14)
  })

  it("lists missing required fields in missingRequired", async () => {
    const partialProduct = {
      id: "prod_123",
      type: { value: "Wigs & Units" },
      metadata: {
        length_in_inches: 14,
        hair_origin: "Brazilian",
        // hair_family, texture, fulfillment_mode, lace_size, lace_type, cap_construction missing
      },
    }
    const req = createReq({ product: partialProduct })
    const res = createRes()
    await GET(req as never, res as never)

    const [body] = res.json.mock.calls[0] as [{ missingRequired: string[] }]
    expect(body.missingRequired).toContain("lace_size")
    expect(body.missingRequired).toContain("lace_type")
    expect(body.missingRequired).toContain("cap_construction")
    expect(body.missingRequired).not.toContain("length_in_inches")
    expect(body.missingRequired).not.toContain("hair_origin")
  })

  it("returns null productForm and empty arrays for unknown product type", async () => {
    const unknownProduct = {
      id: "prod_123",
      type: { value: "Accessories" },
      metadata: {},
    }
    const req = createReq({ product: unknownProduct })
    const res = createRes()
    await GET(req as never, res as never)

    const [body] = res.json.mock.calls[0] as [
      { productForm: null; fields: unknown[]; missingRequired: unknown[] },
    ]
    expect(body.productForm).toBeNull()
    expect(body.fields).toHaveLength(0)
    expect(body.missingRequired).toHaveLength(0)
  })

  it("handles a product with no metadata", async () => {
    const req = createReq({
      product: { id: "prod_123", type: { value: "Wigs & Units" }, metadata: null },
    })
    const res = createRes()
    await GET(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    const [body] = res.json.mock.calls[0] as [{ missingRequired: string[] }]
    expect(body.missingRequired.length).toBeGreaterThan(0)
  })
})

describe("POST /admin/products/:id/hair-fields", () => {
  it("merges incoming hair fields into existing metadata", async () => {
    const existingProduct = {
      id: "prod_123",
      metadata: {
        hair_origin: "Brazilian",
        some_other_key: "preserve_me",
      },
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { texture: "Body Wave", hair_family: "Virgin" },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    const [, update] = productService.updateProducts.mock.calls[0] as [
      string,
      { metadata: Record<string, unknown> },
    ]
    expect(update.metadata).toHaveProperty("hair_origin", "Brazilian")
    expect(update.metadata).toHaveProperty("some_other_key", "preserve_me")
    expect(update.metadata).toHaveProperty("texture", "Body Wave")
    expect(update.metadata).toHaveProperty("hair_family", "Virgin")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it("removes a field when set to null", async () => {
    const existingProduct = {
      id: "prod_123",
      metadata: { hair_origin: "Brazilian", texture: "Body Wave" },
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { texture: null },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    const [, update] = productService.updateProducts.mock.calls[0] as [
      string,
      { metadata: Record<string, unknown> },
    ]
    expect(update.metadata).not.toHaveProperty("texture")
    expect(update.metadata).toHaveProperty("hair_origin", "Brazilian")
  })

  it("removes a field when set to empty string", async () => {
    const existingProduct = {
      id: "prod_123",
      metadata: { lace_size: "13x4" },
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { lace_size: "" },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    const [, update] = productService.updateProducts.mock.calls[0] as [
      string,
      { metadata: Record<string, unknown> },
    ]
    expect(update.metadata).not.toHaveProperty("lace_size")
  })

  it("ignores unknown fields not in HAIR_FIELD_DEFS", async () => {
    const existingProduct = { id: "prod_123", metadata: {} }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { unknown_field: "should_be_ignored", hair_origin: "Indian" },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    const [, update] = productService.updateProducts.mock.calls[0] as [
      string,
      { metadata: Record<string, unknown> },
    ]
    expect(update.metadata).not.toHaveProperty("unknown_field")
    expect(update.metadata).toHaveProperty("hair_origin", "Indian")
  })

  it("stores boolean false correctly", async () => {
    const existingProduct = { id: "prod_123", metadata: {} }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { pre_bleached: false },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    const [, update] = productService.updateProducts.mock.calls[0] as [
      string,
      { metadata: Record<string, unknown> },
    ]
    expect(update.metadata).toHaveProperty("pre_bleached", false)
  })

  it("allows removing a required field when the product is still a draft", async () => {
    const existingProduct = {
      id: "prod_123",
      status: "draft",
      type: { value: "Wigs & Units" },
      metadata: { ...wigProduct.metadata },
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { lace_size: null },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(productService.updateProducts).toHaveBeenCalled()
  })

  it("blocks removing a required field when the product is published", async () => {
    const existingProduct = {
      id: "prod_123",
      status: "published",
      type: { value: "Wigs & Units" },
      metadata: { ...wigProduct.metadata },
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { lace_size: null },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(422)
    const [body] = res.json.mock.calls[0] as [{ message: string }]
    expect(body.message).toMatch(/published product/)
    expect(body.message).toMatch(/Lace Size/)
    expect(productService.updateProducts).not.toHaveBeenCalled()
  })

  it("allows editing optional fields on a published product without blocking", async () => {
    const existingProduct = {
      id: "prod_123",
      status: "published",
      type: { value: "Wigs & Units" },
      metadata: { ...wigProduct.metadata },
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { density: "180%" },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(productService.updateProducts).toHaveBeenCalled()
  })

  it("skips the published guard for unknown product types", async () => {
    const existingProduct = {
      id: "prod_123",
      status: "published",
      type: { value: "Accessories" },
      metadata: {},
    }
    const productService = {
      retrieveProduct: jest.fn().mockResolvedValue(existingProduct),
      updateProducts: jest.fn().mockResolvedValue({}),
    }
    const req = {
      params: { id: "prod_123" },
      body: { hair_origin: "Indian" },
      scope: { resolve: jest.fn().mockReturnValue(productService) },
    }
    const res = createRes()
    await POST(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
  })
})
