import { validatePublishHairFields } from "../publish-validation-middleware"

const createNext = () => jest.fn()

const createReq = ({
  id = "prod_123",
  body = {} as Record<string, unknown>,
  product = {} as Record<string, unknown>,
} = {}) => ({
  params: { id },
  body,
  scope: {
    resolve: jest.fn().mockReturnValue({
      retrieveProduct: jest.fn().mockResolvedValue(product),
    }),
  },
})

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
})

const fullWigMeta = {
  length_in_inches: 14,
  hair_origin: "Brazilian",
  hair_family: "Virgin",
  texture: "Body Wave",
  fulfillment_mode: "ready_to_ship",
  lace_size: "13x4",
  lace_type: "HD",
  cap_construction: "Lace Front",
}

describe("validatePublishHairFields middleware", () => {
  it("calls next() without error when body.status is not 'published'", async () => {
    const req = createReq({ body: { status: "draft" } })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    expect(next).toHaveBeenCalledWith()
    expect(next).toHaveBeenCalledTimes(1)
    // product service should not even be called
    const productService = req.scope.resolve()
    expect(productService.retrieveProduct).not.toHaveBeenCalled()
  })

  it("calls next() without error when status is missing from body", async () => {
    const req = createReq({ body: {} })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    expect(next).toHaveBeenCalledWith()
  })

  it("calls next() without error for unknown product type", async () => {
    const req = createReq({
      body: { status: "published" },
      product: { id: "prod_123", type: { value: "Accessories" }, metadata: {} },
    })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    expect(next).toHaveBeenCalledWith()
    const [arg] = next.mock.calls[0] as [unknown]
    expect(arg).toBeUndefined()
  })

  it("calls next() without error when all required fields are present", async () => {
    const req = createReq({
      body: { status: "published" },
      product: {
        id: "prod_123",
        type: { value: "Wigs & Units" },
        metadata: fullWigMeta,
      },
    })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    expect(next).toHaveBeenCalledWith()
    const [arg] = next.mock.calls[0] as [unknown]
    expect(arg).toBeUndefined()
  })

  it("calls next(MedusaError) when required fields are missing", async () => {
    const req = createReq({
      body: { status: "published" },
      product: {
        id: "prod_123",
        type: { value: "Wigs & Units" },
        metadata: { length_in_inches: 14 }, // most required fields missing
      },
    })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    expect(next).toHaveBeenCalledTimes(1)
    const [error] = next.mock.calls[0] as [{ type: string; message: string }]
    expect(error).toBeDefined()
    expect(error.message).toMatch(/Cannot publish/)
    expect(error.message).toMatch(/wig/)
    // should list at least one missing field label
    expect(error.message).toMatch(/Lace/)
  })

  it("merges incoming body.metadata with existing metadata before validating", async () => {
    // Existing metadata is missing only lace_size
    const existingMeta = { ...fullWigMeta }
    delete (existingMeta as Partial<typeof fullWigMeta>).lace_size

    const req = createReq({
      body: {
        status: "published",
        metadata: { lace_size: "13x4" }, // provided in the same request
      },
      product: {
        id: "prod_123",
        type: { value: "Wigs & Units" },
        metadata: existingMeta,
      },
    })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    // Should pass because lace_size is in the incoming body.metadata
    expect(next).toHaveBeenCalledWith()
    const [arg] = next.mock.calls[0] as [unknown]
    expect(arg).toBeUndefined()
  })

  it("calls next() without error when product retrieval fails", async () => {
    const req = {
      params: { id: "prod_123" },
      body: { status: "published" },
      scope: {
        resolve: jest.fn().mockReturnValue({
          retrieveProduct: jest.fn().mockRejectedValue(new Error("not found")),
        }),
      },
    }
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    expect(next).toHaveBeenCalledWith()
    const [arg] = next.mock.calls[0] as [unknown]
    expect(arg).toBeUndefined()
  })

  it("error message names every missing field label", async () => {
    const req = createReq({
      body: { status: "published" },
      product: {
        id: "prod_123",
        type: { value: "Wigs & Units" },
        metadata: {},
      },
    })
    const res = createRes()
    const next = createNext()

    await validatePublishHairFields(req as never, res as never, next)

    const [error] = next.mock.calls[0] as [{ message: string }]
    expect(error.message).toMatch(/Length/)
    expect(error.message).toMatch(/Hair Origin/)
    expect(error.message).toMatch(/Lace Size/)
    expect(error.message).toMatch(/Cap Construction/)
  })
})
