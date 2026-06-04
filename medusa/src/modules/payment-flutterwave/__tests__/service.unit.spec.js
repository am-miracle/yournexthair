const FlutterwavePaymentService =
  require("../service").default

describe("FlutterwavePaymentService", () => {
  const originalFetch = global.fetch
  const service = new FlutterwavePaymentService(
    {},
    {
      secret_key: "sk_test",
      public_key: "pk_test",
      webhook_secret: "whsec_test",
    }
  )

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it("returns an authorized webhook action when payment_session_id is present in metadata", async () => {
    await expect(
      service.getWebhookActionAndData({
        headers: {
          "verif-hash": "whsec_test",
        },
        data: {
          event: "charge.completed",
          data: {
            id: 12345,
            tx_ref: "ynh-123",
            status: "successful",
            charged_amount: 5600,
            meta: {
              payment_session_id: "payses_123",
            },
          },
        },
      })
    ).resolves.toEqual({
      action: "authorized",
      data: {
        session_id: "payses_123",
        amount: 5600,
      },
    })
  })

  it("parses stringified metadata from webhook payloads", async () => {
    await expect(
      service.getWebhookActionAndData({
        headers: {
          "verif-hash": "whsec_test",
        },
        data: {
          event: "charge.completed",
          data: {
            id: 12345,
            tx_ref: "ynh-123",
            status: "successful",
            amount: 5600,
            meta: JSON.stringify({
              payment_session_id: "payses_456",
            }),
          },
        },
      })
    ).resolves.toEqual({
      action: "authorized",
      data: {
        session_id: "payses_456",
        amount: 5600,
      },
    })
  })

  it("rejects invalid webhook signatures", async () => {
    await expect(
      service.getWebhookActionAndData({
        headers: {
          "verif-hash": "wrong",
        },
        data: {},
      })
    ).rejects.toThrow("Invalid Flutterwave webhook signature")
  })

  it("authorizes when verification matches tx_ref, currency, and paid amount", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        message: "ok",
        data: {
          id: 12345,
          tx_ref: "ynh-123",
          status: "successful",
          amount: 56,
          charged_amount: 56,
          currency: "NGN",
          customer: { email: "test@example.com" },
        },
      }),
    })

    await expect(
      service.authorizePayment({
        data: {
          tx_ref: "ynh-123",
          amount: 5600,
          currency: "NGN",
          customer_email: "test@example.com",
          transaction_id: 12345,
        },
      })
    ).resolves.toMatchObject({
      status: "authorized",
      data: {
        tx_ref: "ynh-123",
        transaction_id: 12345,
      },
    })
  })

  it("rejects authorization when the verified currency differs", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        message: "ok",
        data: {
          id: 12345,
          tx_ref: "ynh-123",
          status: "successful",
          amount: 56,
          charged_amount: 56,
          currency: "USD",
          customer: { email: "test@example.com" },
        },
      }),
    })

    await expect(
      service.authorizePayment({
        data: {
          tx_ref: "ynh-123",
          amount: 5600,
          currency: "NGN",
          customer_email: "test@example.com",
          transaction_id: 12345,
        },
      })
    ).resolves.toMatchObject({
      status: "error",
      data: {
        error: "Currency mismatch",
      },
    })
  })

  it("allows overpayments but rejects underpayments", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          message: "ok",
          data: {
            id: 12345,
            tx_ref: "ynh-123",
            status: "successful",
            amount: 57,
            charged_amount: 57,
            currency: "NGN",
            customer: { email: "test@example.com" },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          message: "ok",
          data: {
            id: 12346,
            tx_ref: "ynh-124",
            status: "successful",
            amount: 55,
            charged_amount: 55,
            currency: "NGN",
            customer: { email: "test@example.com" },
          },
        }),
      })

    await expect(
      service.authorizePayment({
        data: {
          tx_ref: "ynh-123",
          amount: 5600,
          currency: "NGN",
          customer_email: "test@example.com",
          transaction_id: 12345,
        },
      })
    ).resolves.toMatchObject({
      status: "authorized",
    })

    await expect(
      service.authorizePayment({
        data: {
          tx_ref: "ynh-124",
          amount: 5600,
          currency: "NGN",
          customer_email: "test@example.com",
          transaction_id: 12346,
        },
      })
    ).resolves.toMatchObject({
      status: "error",
      data: {
        error: "Paid amount is lower than expected",
      },
    })
  })

  it("uses the transaction refund endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 9876 },
      }),
    })

    await expect(
      service.refundPayment({
        amount: 5600,
        data: {
          tx_ref: "ynh-123",
          amount: 5600,
          currency: "NGN",
          customer_email: "test@example.com",
          transaction_id: 12345,
        },
      })
    ).resolves.toMatchObject({
      data: { refund_id: 9876 },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.flutterwave.com/v3/transactions/12345/refund",
      expect.objectContaining({
        method: "POST",
      })
    )
  })

  it("rejects refund amounts that are zero, negative, or exceed the session amount", async () => {
    const sessionData = {
      tx_ref: "ynh-123",
      amount: 5600,
      currency: "NGN",
      customer_email: "test@example.com",
      transaction_id: 12345,
    }

    await expect(
      service.refundPayment({ amount: 0, data: sessionData })
    ).rejects.toThrow("Invalid refund amount")

    await expect(
      service.refundPayment({ amount: -100, data: sessionData })
    ).rejects.toThrow("Invalid refund amount")

    await expect(
      service.refundPayment({ amount: 5601, data: sessionData })
    ).rejects.toThrow("Invalid refund amount")
  })

  it("rejects a same-length but wrong webhook signature", async () => {
    // "whsec_XXXX" is the same length as "whsec_test" — exercises timingSafeEqual
    await expect(
      service.getWebhookActionAndData({
        headers: { "verif-hash": "whsec_XXXX" },
        data: {},
      })
    ).rejects.toThrow("Invalid Flutterwave webhook signature")
  })
})
