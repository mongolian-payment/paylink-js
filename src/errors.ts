/**
 * Error thrown by the PayLink SDK.
 *
 * Carries the PayLink `response_code` (when the API returned a non-success
 * code) and/or the HTTP status code, plus the raw response body.
 */
export class PayLinkError extends Error {
  /** PayLink response code, e.g. `RC000004`. */
  readonly responseCode?: string;
  /** HTTP status code (if the failure was at the transport level). */
  readonly statusCode?: number;
  /** Raw response body. */
  readonly response?: unknown;

  constructor(
    message: string,
    options: {
      responseCode?: string;
      statusCode?: number;
      response?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "PayLinkError";
    this.responseCode = options.responseCode;
    this.statusCode = options.statusCode;
    this.response = options.response;
  }
}

/** The PayLink response code that indicates success. */
export const SUCCESS_CODE = "RC000000";

/** Known PayLink response codes and their meanings. */
export const RESPONSE_CODE_MESSAGES: Record<string, string> = {
  RC000000: "Success",
  RC000001: "Invalid process code",
  RC000002: "Process code not allowed",
  RC000003: "System error",
  RC000004: "Authentication failed",
  RC000005: "Invalid username",
  RC000006: "Invalid signature",
  RC000015: "Record not found",
  RC000027: "Record not found",
  RC000028: "Record not found",
  VC000008: "Missing required field",
  VC000012: "Invalid pagination",
};

/** Look up a human-readable message for a PayLink response code. */
export function describeResponseCode(code: string): string {
  return RESPONSE_CODE_MESSAGES[code] ?? `PayLink error ${code}`;
}
