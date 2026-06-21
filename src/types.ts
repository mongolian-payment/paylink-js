// =============================================================================
// PayLink External API types
//
// PayLink exposes a single endpoint (`POST /external/process`); the operation
// is selected by the `pc` (process code) request header. Every call returns
// HTTP 200 with a `response_code` field — `RC000000` means success.
// =============================================================================

/**
 * Signs a request body, producing the `X-SIGNATURE` header value.
 *
 * @param body - The exact JSON string sent as the request body.
 * @returns The signature string.
 */
export type SignFn = (body: string) => string;

/** PayLink client configuration. */
export interface PayLinkConfig {
  /**
   * API base URL.
   * - Production: `https://paylink.mn/api/v1`
   * - Test: `https://pay-link.fiba.mn/api/v1`
   */
  baseUrl: string;
  /** Merchant username, sent as the `X-USERNAME` header. */
  username: string;
  /**
   * Secret key for the default HMAC-SHA256 signer. Ignored if {@link sign} is
   * provided. Keep this in an environment variable — never hard-code it.
   */
  signatureKey?: string;
  /**
   * Custom request signer. When provided, it is used verbatim to produce the
   * `X-SIGNATURE` header and {@link signatureKey} is ignored.
   *
   * NOTE: PayLink's exact signature scheme is not published. The built-in
   * default is HMAC-SHA256 (hex) over the request body — supply this function
   * if PayLink specifies something different.
   */
  sign?: SignFn;
}

/** Process codes for the PayLink External API. */
export type ProcessCode =
  | "cu0900"
  | "cu0901"
  | "cu0904"
  | "cu0905"
  | "cu0906"
  | "cu0907"
  | "cu0908"
  | "cu0909"
  | "cu0910";

/** Generic PayLink response envelope. */
export interface PayLinkResponse<T = unknown> {
  /** Result code; `RC000000` indicates success. */
  response_code: string;
  /** Optional human-readable message. */
  response_message?: string;
  /** Operation-specific payload. */
  response: T;
}

/** A sort directive used by list / report operations. */
export interface SortField {
  /** Field name to sort by, e.g. `created_at`. */
  field: string;
  /** Sort direction. */
  dir: "asc" | "desc";
}

// -----------------------------------------------------------------------------
// cu0900 — Create invoice
// -----------------------------------------------------------------------------

/** Input for creating an invoice (cu0900). */
export interface CreateInvoiceInput {
  /** Total invoice amount. */
  amountTotal: number;
  /** Total item count. */
  countTotal: number;
  /** Charged amount. */
  amount: number;
  /** Transaction description (`txndesc`). */
  description: string;
  /** Merchant reference / order number. */
  merchantRef: string;
  /** Fee percentage. */
  feePercent?: number;
  /** Fee amount. */
  feeAmount?: number;
  /** Base amount before fee. */
  baseAmount?: number;
}

/** A created invoice (cu0900 response). */
export interface CreatedInvoice {
  /** PayLink invoice ID. */
  invid: string;
  /** Hosted payment page URL. */
  paymentLink: string;
  /** Invoice status, e.g. `pending`. */
  status: string;
  /** Total amount. */
  amountTotal: number;
  /** Currency, e.g. `MNT`. */
  currency: string;
}

// -----------------------------------------------------------------------------
// cu0901 / cu0907 / cu0909 — list & report filters
// -----------------------------------------------------------------------------

/** Filter for listing invoices (cu0901) and the invoice report (cu0907). */
export interface ListInvoicesInput {
  /** Filter by invoice numeric ID. */
  id?: string | number;
  /** Filter by merchant reference. */
  merchantRef?: string;
  /** Filter by status. */
  status?: string;
  /** Start date (`YYYY-MM-DD HH24:MI:SS`). */
  dateFrom?: string;
  /** End date (`YYYY-MM-DD HH24:MI:SS`). */
  dateTo?: string;
  /** Pagination offset. */
  skip?: number;
  /** Page size. */
  take?: number;
  /** Sort directives. */
  sort?: SortField[];
}

/** Filter for the transaction report (cu0909). */
export interface TransactionReportInput {
  /** Filter by invoice ID. */
  invoiceId?: string | number;
  /** Start date (`YYYY-MM-DD HH24:MI:SS`). */
  dateFrom?: string;
  /** End date (`YYYY-MM-DD HH24:MI:SS`). */
  dateTo?: string;
  /** Filter by transaction status ID. */
  statusId?: number | null;
  /** Pagination offset. */
  skip?: number;
  /** Page size. */
  take?: number;
  /** Sort directives. */
  sort?: SortField[];
}

// -----------------------------------------------------------------------------
// Response payloads (as returned by the API; fields are passed through as-is)
// -----------------------------------------------------------------------------

/** An invoice summary row (cu0901). */
export interface InvoiceListItem {
  id: number;
  invid: string;
  status: string;
  amount_total: number;
  can_cancel?: boolean;
  [key: string]: unknown;
}

/** A transaction attached to an invoice (cu0904). */
export interface InvoiceTransaction {
  id: number;
  amount: number;
  currency: string;
  description?: string;
  statusid?: number;
  callbacked_at?: string | null;
  ordernum?: string;
  amount_fee?: number;
  settle_at?: string | null;
  settle_amount?: number;
  [key: string]: unknown;
}

/** Full invoice detail (cu0904). */
export interface InvoiceDetail {
  id: number;
  invid: string;
  status: string;
  amount_total: number;
  transactions: InvoiceTransaction[];
  [key: string]: unknown;
}

/** Result of the batch mark-paid operation (cu0906). */
export interface BatchMarkPaidResult {
  status: string;
  message: string;
  data: {
    amount_total: number;
    system_paid: number;
    manual_paid: number;
    remaining: number;
    [key: string]: unknown;
  };
}

/** A paginated report payload (cu0907 / cu0909). */
export interface ReportResult<TRow = Record<string, unknown>> {
  data: TRow[];
  total: number;
  [key: string]: unknown;
}

/** Invoice summary counters (cu0908). */
export interface InvoiceSummary {
  total_count: number;
  total_amount_total: number;
  paid_count: number;
  paid_amount_total: number;
  pending_count: number;
  pending_amount_total: number;
  canceled_count: number;
  expired_count: number;
  [key: string]: unknown;
}

/** Transaction summary counters (cu0910). */
export interface TransactionSummary {
  total_amount: number;
  total_fee: number;
  total_settle_amount: number;
  approved_count: number;
  [key: string]: unknown;
}
