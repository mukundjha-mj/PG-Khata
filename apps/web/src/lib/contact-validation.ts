/**
 * Shared phone/email validation for every form in the app that collects a
 * tenant's or owner's contact details - the public signup/complaint links,
 * the owner's "Add tenant" form, and the owner's own profile. Every phone
 * collected here is assumed to double as a WhatsApp contact, so the shape
 * enforced is specifically an Indian mobile number, not phone numbers in
 * general.
 */

/** Exactly ten digits starting 6-9 - the shape of a real Indian mobile/WhatsApp number. */
export function isValidIndianMobileDigits(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

/** Digits only, with a leading "91" country code stripped if present. */
function bareDigitsOf(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

/**
 * Normalises a phone number to "+91XXXXXXXXXX", accepting a bare 10-digit
 * number or one already carrying the 91 country code, or null if it isn't a
 * plausible Indian mobile number. Used server-side so a direct API call
 * (bypassing the form's fixed +91 UI) can't sneak in garbage.
 */
export function toWhatsAppPhoneOrNull(raw: string): string | null {
  const bare = bareDigitsOf(raw);
  return isValidIndianMobileDigits(bare) ? `+91${bare}` : null;
}

/**
 * Best-effort extraction of the last 10 digits from a stored phone value, for
 * pre-filling the fixed-+91 phone input when editing an existing record whose
 * number may predate this validation (e.g. saved as "+91 98765 43210" or
 * "098765 43210" before this field enforced a strict shape). Does not itself
 * validate - `isValidIndianMobileDigits` still gates on save.
 */
export function extractPhoneDigitsForEditing(raw: string | null | undefined): string {
  if (!raw) return "";
  const bare = bareDigitsOf(raw);
  return bare.slice(-10);
}

/**
 * Format check only - confirms the string looks like an email address, not
 * that the mailbox exists or can receive mail. Actually verifying deliverability
 * needs a DNS/MX lookup or a third-party API; not worth the latency/dependency
 * for an optional field on an intake form.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
