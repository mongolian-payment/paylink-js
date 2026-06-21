import type { PayLinkConfig } from "./types.js";

/**
 * Load PayLink configuration from environment variables.
 *
 * | Environment Variable    | Config Field   | Required |
 * |-------------------------|----------------|----------|
 * | PAYLINK_BASE_URL        | baseUrl        | yes      |
 * | PAYLINK_USERNAME        | username       | yes      |
 * | PAYLINK_SIGNATURE_KEY   | signatureKey   | no*      |
 *
 * \*Required if you rely on the built-in HMAC-SHA256 signer rather than
 * passing a custom `sign` function. Secrets must come from the environment —
 * never hard-code them.
 *
 * @throws {Error} If a required variable is missing.
 */
export function loadConfigFromEnv(): PayLinkConfig {
  const baseUrl = process.env.PAYLINK_BASE_URL;
  const username = process.env.PAYLINK_USERNAME;
  const signatureKey = process.env.PAYLINK_SIGNATURE_KEY;

  if (!baseUrl) throw new Error("Missing PAYLINK_BASE_URL environment variable");
  if (!username) throw new Error("Missing PAYLINK_USERNAME environment variable");

  const config: PayLinkConfig = { baseUrl, username };
  if (signatureKey) config.signatureKey = signatureKey;
  return config;
}
