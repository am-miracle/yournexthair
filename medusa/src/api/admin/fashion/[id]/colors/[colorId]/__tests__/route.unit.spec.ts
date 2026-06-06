import { DELETE, GET, POST } from "../route"

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }

  return res
}

const createRequest = (overrides?: {
  body?: Record<string, unknown>
  params?: Record<string, string>
  service?: Record<string, jest.Mock>
}) => {
  const service = overrides?.service ?? {
    getColorForMaterial: jest.fn(),
    updateColorForMaterial: jest.fn(),
    deleteColorForMaterial: jest.fn(),
  }

  return {
    body: overrides?.body ?? {},
    params: {
      id: "material_123",
      colorId: "color_123",
      ...(overrides?.params ?? {}),
    },
    scope: {
      resolve: jest.fn().mockReturnValue(service),
    },
    service,
  }
}

describe("fashion color route", () => {
  it("loads a color through the material-aware module method", async () => {
    const req = createRequest({
      service: {
        getColorForMaterial: jest.fn().mockResolvedValue({ id: "color_123" }),
        updateColorForMaterial: jest.fn(),
        deleteColorForMaterial: jest.fn(),
      },
    })
    const res = createResponse()

    await GET(req as never, res as never)

    expect(req.scope.resolve).toHaveBeenCalledWith("fashionModuleService")
    expect(req.service.getColorForMaterial).toHaveBeenCalledWith("material_123", "color_123")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ id: "color_123" })
  })

  it("updates a color through the material-aware module method", async () => {
    const req = createRequest({
      body: {
        name: "Blue",
        hex_code: "#AABBCC",
      },
      service: {
        getColorForMaterial: jest.fn(),
        updateColorForMaterial: jest.fn().mockResolvedValue({ id: "color_123" }),
        deleteColorForMaterial: jest.fn(),
      },
    })
    const res = createResponse()

    await POST(req as never, res as never)

    expect(req.service.updateColorForMaterial).toHaveBeenCalledWith(
      "material_123",
      "color_123",
      {
        name: "Blue",
        hex_code: "#AABBCC",
      },
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ id: "color_123" })
  })

  it("deletes a color through the material-aware module method", async () => {
    const req = createRequest({
      service: {
        getColorForMaterial: jest.fn(),
        updateColorForMaterial: jest.fn(),
        deleteColorForMaterial: jest.fn().mockResolvedValue({ id: "color_123" }),
      },
    })
    const res = createResponse()

    await DELETE(req as never, res as never)

    expect(req.service.deleteColorForMaterial).toHaveBeenCalledWith("material_123", "color_123")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ id: "color_123" })
  })
})
