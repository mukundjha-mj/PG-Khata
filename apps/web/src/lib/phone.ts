/**
 * Phone normalisation for WhatsApp.
 *
 * Tenant phone numbers are typed by hand into a free-text field, so the same
 * number arrives as "9876543210", "+91 98765 43210", "098765-43210" and
 * "0091 9876543210". The Cloud API wants bare digits in E.164 without the plus,
 * and silently accepts a wrong number rather than rejecting it — a malformed
 * number does not error, it just messages nobody.
 */

/** Digits only, with Indian trunk and international prefixes stripped. */
function digitsOf(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Converts a stored phone number to the digits-only E.164 form the Cloud API
 * expects, or null when it cannot be trusted.
 *
 * `defaultDialCode` is applied only to a bare national number; anything already
 * carrying a country code is left alone.
 */
export function normalisePhone(raw: string, defaultDialCode = "91"): string | null {
  if (!raw) return null;
  let digits = digitsOf(raw);
  if (!digits) return null;

  // 00 is the international access prefix: 00919876543210 -> 919876543210.
  if (digits.startsWith("00")) digits = digits.slice(2);

  const dial = digitsOf(defaultDialCode) || "91";

  // Indian mobile numbers are ten digits starting 6-9. A leading 0 is the
  // domestic trunk prefix and is never part of the number.
  if (dial === "91") {
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10) {
      return /^[6-9]/.test(digits) ? `${dial}${digits}` : null;
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      return /^[6-9]/.test(digits.slice(2)) ? digits : null;
    }
    return null;
  }

  // Other dial codes: accept a bare national number or an already-prefixed one.
  if (digits.startsWith(dial) && digits.length > dial.length) return digits;
  // E.164 allows at most 15 digits, and a subscriber number below 6 is not real.
  if (digits.length >= 6 && digits.length <= 15 - dial.length) return `${dial}${digits}`;
  return null;
}
