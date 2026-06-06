import {
  assertSuccessfulVerification,
  verifyFlutterwaveTransaction,
} from "../verification"

describe("Flutterwave verification helpers", () => {
  const fetchMock = jest.spyOn(global, "fetch")

  afterEach(() => {
    fetchMock.mockReset()
    jest.restoreAllMocks()
  })

  it("verifies a transaction through the Flutterwave API", async () => {
    let capturedInit: RequestInit | undefined
    const response: Response = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "success",
          message: "ok",
          data: {
            id: 12345,
            tx_ref: "ynh-123",
            status: "successful",
            amount: 56,
            charged_amount: 56,
            currency: "NGN",
          },
        }),
    } as Response

    fetchMock.mockImplementation((_input, init) => {
      capturedInit = init
      return Promise.resolve(response)
    })

    await expect(verifyFlutterwaveTransaction(12345, "sk_test")).resolves.toMatchObject({
      status: "success",
      data: {
        id: 12345,
        tx_ref: "ynh-123",
      },
    })

    expect(capturedInit?.headers).toMatchObject({
      Authorization: "Bearer sk_test",
    })
  })

  it("rejects verification results that do not match the session", () => {
    expect(() =>
      assertSuccessfulVerification(
        {
          status: "success",
          message: "ok",
          data: {
            id: 12345,
            tx_ref: "ynh-123",
            status: "successful",
            amount: 56,
            charged_amount: 56,
            currency: "USD",
          },
        },
        {
          tx_ref: "ynh-123",
          amount: 5600,
          currency: "NGN",
        },
      ),
    ).toThrow("Currency mismatch")
  })
})
