import { POST } from "../callback/route"

describe("Flutterwave callback route", () => {
  const originalFetch = global.fetch
  const originalSecret = process.env.FLW_SECRET_KEY

  beforeEach(() => {
    process.env.FLW_SECRET_KEY = "sk_test"
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.FLW_SECRET_KEY = originalSecret
    jest.restoreAllMocks()
  })

  const createResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    return res
  }

  const createRequest = (overrides?: {
    session?: Record<string, unknown>
    body?: Record<string, unknown>
    updatePaymentSession?: jest.Mock
  }) => {
    const session = {
      id: "payses_123",
      amount: 5600,
      currency_code: "ngn",
      data: {
        tx_ref: "ynh-123",
        amount: 5600,
      },
      ...(overrides?.session ?? {}),
    }

    const updatePaymentSession =
      overrides?.updatePaymentSession ?? jest.fn().mockResolvedValue(undefined)

    return {
      body: {
        session_id: "payses_123",
        transaction_id: 12345,
        tx_ref: "ynh-123",
        ...(overrides?.body ?? {}),
      },
      scope: {
        resolve: jest.fn().mockReturnValue({
          retrievePaymentSession: jest.fn().mockResolvedValue(session),
          updatePaymentSession,
        }),
      },
      updatePaymentSession,
    }
  }

  it("stores the transaction ID when verification succeeds", async () => {
    const req = createRequest()
    const res = createResponse()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: "success",
        data: {
          id: 12345,
          tx_ref: "ynh-123",
          status: "successful",
          amount: 56,
          charged_amount: 56,
          currency: "NGN",
        },
      }),
    })

    await POST(req as never, res as never)

    expect(req.updatePaymentSession).toHaveBeenCalledWith({
      id: "payses_123",
      amount: 5600,
      currency_code: "ngn",
      data: {
        amount: 5600,
        tx_ref: "ynh-123",
        transaction_id: 12345,
      },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it("rejects mismatched currency", async () => {
    const req = createRequest()
    const res = createResponse()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: "success",
        data: {
          id: 12345,
          tx_ref: "ynh-123",
          status: "successful",
          amount: 56,
          charged_amount: 56,
          currency: "USD",
        },
      }),
    })

    await POST(req as never, res as never)

    expect(req.updatePaymentSession).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Currency mismatch" })
  })

  it("allows overpayments but rejects underpayments", async () => {
    const overpayReq = createRequest()
    const overpayRes = createResponse()
    const underpayReq = createRequest({
      session: { data: { tx_ref: "ynh-124" } },
      body: { tx_ref: "ynh-124", transaction_id: 12346 },
    })
    const underpayRes = createResponse()

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "success",
          data: {
            id: 12345,
            tx_ref: "ynh-123",
            status: "successful",
            amount: 57,
            charged_amount: 57,
            currency: "NGN",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "success",
          data: {
            id: 12346,
            tx_ref: "ynh-124",
            status: "successful",
            amount: 55,
            charged_amount: 55,
            currency: "NGN",
          },
        }),
      })

    await POST(overpayReq as never, overpayRes as never)
    await POST(underpayReq as never, underpayRes as never)

    expect(overpayReq.updatePaymentSession).toHaveBeenCalled()
    expect(overpayRes.status).toHaveBeenCalledWith(200)
    expect(underpayReq.updatePaymentSession).not.toHaveBeenCalled()
    expect(underpayRes.status).toHaveBeenCalledWith(400)
    expect(underpayRes.json).toHaveBeenCalledWith({
      error: "Paid amount is lower than expected",
    })
  })
})
