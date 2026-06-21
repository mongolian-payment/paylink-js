import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { PayLinkClient } from "../src/client.js";
import { PayLinkError } from "../src/errors.js";

const config = {
  baseUrl: "https://pay-link.fiba.mn/api/v1",
  username: "test-user",
  signatureKey: "test-key",
};

function okResponse<T>(response: T, code = "RC000000") {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve({ response_code: code, response }),
  };
}

describe("PayLinkClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a signer", () => {
    expect(
      () => new PayLinkClient({ baseUrl: "https://x", username: "u" }),
    ).toThrow(/signatureKey/);
  });

  it("creates an invoice and maps the response to camelCase", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        invid: "INV-1",
        payment_link: "https://paylink.mn/p/INV-1",
        status: "pending",
        amount_total: 10000,
        currency: "MNT",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new PayLinkClient(config);
    const invoice = await client.createInvoice({
      amountTotal: 10000,
      countTotal: 1,
      amount: 10000,
      description: "Order #1",
      merchantRef: "ORDER-1",
      feePercent: 1,
    });

    expect(invoice.invid).toBe("INV-1");
    expect(invoice.paymentLink).toBe("https://paylink.mn/p/INV-1");
    expect(invoice.amountTotal).toBe(10000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://pay-link.fiba.mn/api/v1/external/process");
    const headers = init.headers as Record<string, string>;
    expect(headers.pc).toBe("cu0900");
    expect(headers["X-USERNAME"]).toBe("test-user");

    // Signature is HMAC-SHA256 hex of the exact body.
    const expectedSig = createHmac("sha256", "test-key")
      .update(init.body as string, "utf8")
      .digest("hex");
    expect(headers["X-SIGNATURE"]).toBe(expectedSig);

    // Body uses snake_case wire fields.
    expect(JSON.parse(init.body as string)).toMatchObject({
      amount_total: 10000,
      count_total: 1,
      txndesc: "Order #1",
      merchant_ref: "ORDER-1",
      fee_percent: 1,
    });
  });

  it("supports a custom signer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PayLinkClient({
      baseUrl: config.baseUrl,
      username: "u",
      sign: () => "custom-sig",
    });
    await client.listInvoices();

    const init = fetchMock.mock.calls[0][1];
    expect((init.headers as Record<string, string>)["X-SIGNATURE"]).toBe(
      "custom-sig",
    );
  });

  it("sends pagination defaults for transaction reports", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse({ data: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PayLinkClient(config);
    await client.transactionReport({ invoiceId: 5 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      skip: 0,
      take: 20,
      statusid: null,
      invoice_id: 5,
    });
  });

  it("throws PayLinkError on a non-success response_code", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(null, "RC000004"));
    vi.stubGlobal("fetch", fetchMock);

    const client = new PayLinkClient(config);
    await expect(client.getInvoice("INV-1")).rejects.toThrow(PayLinkError);

    try {
      await client.getInvoice("INV-1");
    } catch (err) {
      expect((err as PayLinkError).responseCode).toBe("RC000004");
    }
  });

  it("throws PayLinkError on an HTTP error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new PayLinkClient(config);
    await expect(client.cancelInvoice("INV-1")).rejects.toThrow(PayLinkError);
  });
});
