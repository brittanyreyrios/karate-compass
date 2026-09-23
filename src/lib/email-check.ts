/**
 * Round 53 — an account was created for `eayala185@gmail` (no TLD). The auth
 * service accepted it, mailed a domain that does not exist, and left the family
 * with an unconfirmable account that also blocked re-registration.
 *
 * The browser's own `type="email"` validation accepts `name@gmail`, because the
 * HTML spec deliberately allows intranet-style hostnames. We require a real
 * public domain ending instead.
 *
 * Deliberately conservative: one `@`, non-empty local part, a dotted domain, and
 * a final label of at least two letters. No attempt to validate the whole of
 * RFC 5322 — the point is to catch a missing `.com`, not to police exotic but
 * legitimate addresses.
 */
const EMAIL_WITH_TLD = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export function isEmailWithTld(value: string): boolean {
  return EMAIL_WITH_TLD.test(value.trim());
}

export const EMAIL_TLD_MESSAGE =
  "That email address is missing its domain ending — for example name@gmail.com, not name@gmail.";
