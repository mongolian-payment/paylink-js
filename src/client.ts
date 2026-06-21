import { createHmac } from "node:crypto";
import {
  PayLinkError,
  SUCCESS_CODE,
  describeResponseCode,
} from "./errors.js";
import type {
  BatchMarkPaidResult,
  CreatedInvoice,
  CreateInvoiceInput,
  InvoiceDetail,
  InvoiceListItem,
  InvoiceSummary,
  ListInvoicesInput,
  PayLinkConfig,
  PayLinkResponse,
  ProcessCode,
  ReportResult,
  SignFn,
  TransactionReportInput,
  TransactionSummary,
} from "./types.js";

/**
 * PayLink card-payment API client.
 *
 * Wraps PayLink's single `POST /external/process` endpoint; each method sets
 * the appropriate `pc` (process code) header. Successful calls return the
 * `response` payload; non-success `response_code`s throw a {@link PayLinkError}.
 *
 * @example
 * ```ts
 * import { PayLinkClient } from "@mongolian-payment/paylink";
 *
 * const client = new PayLinkClient({
 *   baseUrl: "https://paylink.mn/api/v1",
 *   username: process.env.PAYLINK_USERNAME!,
 *   signatureKey: process.env.PAYLINK_SIGNATURE_KEY!,
 * });
 *
 * const invoice = await client.createInvoice({
 *   amountTotal: 10000,
 *   countTotal: 1,
 *   amount: 10000,
 *   description: "Order #123",
 *   merchantRef: "ORDER-123",
 * });
 * // redirect the buyer to invoice.paymentLink
 * ```
 */
export class PayLinkClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly sign: SignFn;

  constructor(config: PayLinkConfig) {
    if (!config.baseUrl) throw new Error("PayLinkClient: baseUrl is required");
    if (!config.username) throw new Error("PayLinkClient: username is required");

    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.username = config.username;

    if (config.sign) {
      this.sign = config.sign;
    } else if (config.signatureKey) {
      const key = config.signatureKey;
      // Default signer. NOTE: PayLink's exact scheme is not published; this
      // assumes HMAC-SHA256 (hex) over the request body. Pass `sign` to
      // override if PayLink specifies otherwise.
      this.sign = (body: string) =>
        createHmac("sha256", key).update(body, "utf8").digest("hex");
    } else {
      throw new Error(
        "PayLinkClient: provide either `signatureKey` (for the default HMAC signer) or a custom `sign` function",
      );
    }
  }

  // ==========================================================================
  // Core transport
  // ==========================================================================

  /** Send a process-code request and unwrap the `response` payload. */
  private async process<T>(pc: ProcessCode, payload: unknown): Promise<T> {
    const body = JSON.stringify(payload ?? {});
    const signature = this.sign(body);

    const res = await fetch(`${this.baseUrl}/external/process`, {
      method: "POST",
      headers: {
        pc,
        "X-USERNAME": this.username,
        "X-SIGNATURE": signature,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    let parsed: PayLinkResponse<T> | undefined;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      parsed = (await res.json().catch(() => undefined)) as
        | PayLinkResponse<T>
        | undefined;
    }

    if (!res.ok) {
      throw new PayLinkError(
        `PayLink HTTP error: ${pc} (${res.status})`,
        { statusCode: res.status, response: parsed },
      );
    }

    if (!parsed || typeof parsed.response_code !== "string") {
      throw new PayLinkError(`PayLink: malformed response for ${pc}`, {
        statusCode: res.status,
        response: parsed,
      });
    }

    if (parsed.response_code !== SUCCESS_CODE) {
      throw new PayLinkError(
        `PayLink ${pc} failed: ${parsed.response_code} - ${parsed.response_message ?? describeResponseCode(parsed.response_code)}`,
        { responseCode: parsed.response_code, response: parsed },
      );
    }

    return parsed.response;
  }

  // ==========================================================================
  // Invoices
  // ==========================================================================

  /** Create an invoice (cu0900). */
  async createInvoice(input: CreateInvoiceInput): Promise<CreatedInvoice> {
    const wire: Record<string, unknown> = {
      amount_total: input.amountTotal,
      count_total: input.countTotal,
      amount: input.amount,
      txndesc: input.description,
      merchant_ref: input.merchantRef,
    };
    if (input.feePercent !== undefined) wire.fee_percent = input.feePercent;
    if (input.feeAmount !== undefined) wire.fee_amount = input.feeAmount;
    if (input.baseAmount !== undefined) wire.base_amount = input.baseAmount;

    const r = await this.process<{
      invid: string;
      payment_link: string;
      status: string;
      amount_total: number;
      currency: string;
    }>("cu0900", wire);

    return {
      invid: r.invid,
      paymentLink: r.payment_link,
      status: r.status,
      amountTotal: r.amount_total,
      currency: r.currency,
    };
  }

  /** List invoices (cu0901). */
  async listInvoices(
    input: ListInvoicesInput = {},
  ): Promise<InvoiceListItem[]> {
    return this.process<InvoiceListItem[]>("cu0901", buildListPayload(input));
  }

  /** Get full invoice detail including transactions (cu0904). */
  async getInvoice(invid: string): Promise<InvoiceDetail> {
    return this.process<InvoiceDetail>("cu0904", { invid });
  }

  /** Cancel an invoice (cu0905). */
  async cancelInvoice(invid: string): Promise<unknown> {
    return this.process<unknown>("cu0905", { invid });
  }

  /** Batch mark an invoice as paid (cu0906). */
  async batchMarkPaid(invid: string): Promise<BatchMarkPaidResult> {
    return this.process<BatchMarkPaidResult>("cu0906", { invid });
  }

  // ==========================================================================
  // Reports & summaries
  // ==========================================================================

  /** Invoice report (cu0907). */
  async invoiceReport(
    input: ListInvoicesInput = {},
  ): Promise<ReportResult> {
    return this.process<ReportResult>("cu0907", buildListPayload(input));
  }

  /** Invoice summary counters (cu0908). */
  async invoiceSummary(
    input: ListInvoicesInput = {},
  ): Promise<InvoiceSummary> {
    return this.process<InvoiceSummary>("cu0908", buildListPayload(input));
  }

  /** Transaction report (cu0909). */
  async transactionReport(
    input: TransactionReportInput = {},
  ): Promise<ReportResult> {
    return this.process<ReportResult>("cu0909", buildTxnPayload(input));
  }

  /** Transaction summary counters (cu0910). */
  async transactionSummary(
    input: TransactionReportInput = {},
  ): Promise<TransactionSummary> {
    return this.process<TransactionSummary>("cu0910", buildTxnPayload(input));
  }
}

// ===========================================================================
// Payload builders (camelCase input -> snake_case wire)
// ===========================================================================

function buildListPayload(input: ListInvoicesInput): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    skip: input.skip ?? 0,
    take: input.take ?? 20,
  };
  if (input.id !== undefined) wire.id = input.id;
  if (input.merchantRef !== undefined) wire.merchant_ref = input.merchantRef;
  if (input.status !== undefined) wire.status = input.status;
  if (input.dateFrom !== undefined) wire.date_from = input.dateFrom;
  if (input.dateTo !== undefined) wire.date_to = input.dateTo;
  if (input.sort !== undefined) wire.sort = input.sort;
  return wire;
}

function buildTxnPayload(
  input: TransactionReportInput,
): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    skip: input.skip ?? 0,
    take: input.take ?? 20,
    statusid: input.statusId ?? null,
  };
  if (input.invoiceId !== undefined) wire.invoice_id = input.invoiceId;
  if (input.dateFrom !== undefined) wire.date_from = input.dateFrom;
  if (input.dateTo !== undefined) wire.date_to = input.dateTo;
  if (input.sort !== undefined) wire.sort = input.sort;
  return wire;
}
