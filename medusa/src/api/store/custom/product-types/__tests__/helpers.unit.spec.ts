import { listProductTypes, refetchProductType } from "../helpers"

const createScope = (queryGraph = jest.fn()) =>
  ({
    resolve: jest.fn().mockReturnValue({
      graph: queryGraph,
    }),
  }) as never

describe("product type helpers", () => {
  it("refetches a single product type", async () => {
    const graph = jest.fn().mockResolvedValue({
      data: [
        {
          id: "pt_123",
          value: "Wigs & Units",
        },
      ],
    })

    await expect(
      refetchProductType("pt_123", createScope(graph), ["id", "value"] as never),
    ).resolves.toMatchObject({
      id: "pt_123",
      value: "Wigs & Units",
    })

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_type",
        filters: { id: "pt_123" },
        fields: ["id", "value"],
      }),
    )
  })

  it("lists product types through the shared helper", async () => {
    const graph = jest.fn().mockResolvedValue({
      data: [{ id: "pt_123" }],
      metadata: { count: 1, skip: 0, take: 20 },
    })

    await expect(
      listProductTypes(
        createScope(graph),
        { q: "wig" },
        ["id", "value"],
        { limit: 20, offset: 0 },
      ),
    ).resolves.toEqual({
      productTypes: [{ id: "pt_123" }],
      metadata: { count: 1, skip: 0, take: 20 },
    })

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_types",
        filters: { q: "wig" },
        fields: ["id", "value"],
        pagination: { limit: 20, offset: 0 },
      }),
    )
  })
})
