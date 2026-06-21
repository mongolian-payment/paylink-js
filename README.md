# @mongolian-payment/paylink

PayLink card payment SDK for Node.js — create invoices, query transactions, run reports.

[![npm version](https://img.shields.io/npm/v/@mongolian-payment/paylink.svg)](https://www.npmjs.com/package/@mongolian-payment/paylink)
[![license](https://img.shields.io/npm/l/@mongolian-payment/paylink.svg)](./LICENSE)

> Part of the **[mongolian-payment](https://github.com/mongolian-payment)** SDK suite.
> Also available for Python: **[mongolian-payment-paylink](https://pypi.org/project/mongolian-payment-paylink/)** ([source](https://github.com/mongolian-payment/paylink-py)).

Wraps the PayLink External API (single `POST /external/process` endpoint, process-code driven).

## Installation

```bash
npm install @mongolian-payment/paylink
```

Requires Node.js >= 18.0.0 (uses native `fetch` and `node:crypto`).

## Quick Start

```typescript
import { PayLinkClient } from '@mongolian-payment/paylink';

const client = new PayLinkClient({
  baseUrl: 'https://paylink.mn/api/v1', // test: https://pay-link.fiba.mn/api/v1
  username: 'MERCHANT_USERNAME',
  signatureKey: 'YOUR_SIGNATURE_KEY',
});

const invoice = await client.createInvoice({
  amountTotal: 10000,
  countTotal: 1,
  amount: 10000,
  description: 'Order #123',
  merchantRef: 'ORDER-123',
});
console.log(invoice.paymentLink); // redirect the buyer here
console.log(invoice.invid);

// Look up an invoice and its transactions
const detail = await client.getInvoice(invoice.invid);
console.log(detail.status, detail.transactions);
```

## Authentication & signing

Every request sends three headers: `pc` (process code), `X-USERNAME`, and `X-SIGNATURE`.

> **Note on the signature.** PayLink's exact signing scheme is not published. By
> default this SDK signs the **HMAC-SHA256 (hex) of the JSON request body**, keyed
> by `signatureKey`. If PayLink specifies a different scheme, pass your own
> `sign` function — it receives the exact body string and returns the signature:
>
> ```typescript
> new PayLinkClient({
>   baseUrl, username,
>   sign: (body) => mySignature(body),
> });
> ```

## Environment Variables

```bash
PAYLINK_BASE_URL=https://paylink.mn/api/v1
PAYLINK_USERNAME=MERCHANT_USERNAME
PAYLINK_SIGNATURE_KEY=your-signature-key
```

```typescript
import { PayLinkClient, loadConfigFromEnv } from '@mongolian-payment/paylink';
const client = new PayLinkClient(loadConfigFromEnv());
```

## API Methods

| Method | Process code | Description |
|--------|--------------|-------------|
| `createInvoice(input)` | cu0900 | Create an invoice → `CreatedInvoice` |
| `listInvoices(input?)` | cu0901 | List invoices |
| `getInvoice(invid)` | cu0904 | Invoice detail incl. transactions |
| `cancelInvoice(invid)` | cu0905 | Cancel an invoice |
| `batchMarkPaid(invid)` | cu0906 | Batch mark an invoice paid |
| `invoiceReport(input?)` | cu0907 | Paginated invoice report |
| `invoiceSummary(input?)` | cu0908 | Invoice summary counters |
| `transactionReport(input?)` | cu0909 | Paginated transaction report |
| `transactionSummary(input?)` | cu0910 | Transaction summary counters |

List/report/summary results are returned as the API sends them (snake_case keys).
`createInvoice` maps to a camelCase `CreatedInvoice`. Dates use the
`YYYY-MM-DD HH24:MI:SS` format.

## Endpoints

| Environment | Base URL |
|-------------|----------|
| Production | `https://paylink.mn/api/v1` |
| Test | `https://pay-link.fiba.mn/api/v1` |

## Error Handling

Every call returns HTTP 200; the result is driven by `response_code` (`RC000000` =
success). Non-success codes and transport errors throw `PayLinkError`:

```typescript
import { PayLinkError } from '@mongolian-payment/paylink';

try {
  await client.getInvoice('INV-404');
} catch (err) {
  if (err instanceof PayLinkError) {
    console.error(err.message);       // "PayLink cu0904 failed: RC000015 - Record not found"
    console.error(err.responseCode);  // "RC000015"
    console.error(err.statusCode);    // set for HTTP-level failures
    console.error(err.response);      // raw response body
  }
}
```

## License

MIT
