/**
 * UPI deep links for direct owner collection.
 *
 * The tenant's UPI app opens with the owner's VPA and the exact amount already
 * filled in. Money moves tenant -> owner directly: the platform is not in the
 * path, so there is no aggregator licensing question and no MDR on standard
 * UPI P2M.
 *
 * Spec: NPCI UPI Linking Specification, the `upi://pay` intent.
 */

export type UpiPaymentRequest = {
  vpa: string;
  payeeName: string;
  amount: number;
  /** Shown as the payment note in the tenant's UPI app. */
  note?: string;
};

/**
 * Deliberately permissive on the handle — NPCI leaves its charset to each PSP —
 * but strict on shape. Mirrors settings_upi_vpa_format in the database; the
 * handle is capped at 255 (not 256) because Postgres's regex engine rejects
 * repetition counts above RE_DUP_MAX (255).
 */
const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa.trim());
}

/**
 * UPI truncates long values and some PSPs reject `&`, `=` or `#` even encoded,
 * so notes are stripped to a conservative charset rather than escaped.
 */
function sanitiseNote(note: string): string {
  return note
    .replace(/[^a-zA-Z0-9 .\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

/**
 * Builds a `upi://pay` intent URI.
 *
 * Amount is fixed to two decimals: UPI treats `am` as rupees, and a float like
 * 8000.005 would otherwise reach the PSP unrounded and be rejected or, worse,
 * silently truncated to a different figure than the bill.
 */
export function buildUpiIntent(request: UpiPaymentRequest): string {
  const vpa = request.vpa.trim();
  if (!isValidVpa(vpa)) throw new Error(`Invalid UPI ID: ${vpa}`);
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new Error("UPI amount must be a positive number");
  }
  // UPI has no per-transaction ceiling of its own; banks cap it, commonly at
  // ₹1 lakh. Rent above that is a data-entry error far more often than a real
  // bill, and a silently-failing QR is worse than an explicit refusal.
  if (request.amount > 100000) {
    throw new Error("UPI amount exceeds the ₹1,00,000 per-transaction limit");
  }

  const params = new URLSearchParams({
    pa: vpa,
    pn: request.payeeName.trim().slice(0, 50),
    am: request.amount.toFixed(2),
    cu: "INR",
  });
  const note = request.note ? sanitiseNote(request.note) : "";
  if (note) params.set("tn", note);

  // URLSearchParams encodes space as "+", which UPI apps read literally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** Payment note for a rent bill, e.g. "Rent Mar 2026 Room 12". */
export function buildBillNote(monthLabel: string, roomNumber: string): string {
  return `Rent ${monthLabel} Room ${roomNumber}`;
}

/**
 * Non-throwing variant for batch paths.
 *
 * A single unusable bill — bad VPA, balance over the transaction limit — must
 * not abort a run that is sending reminders for everyone else. The reminder is
 * still worth delivering without a pay link.
 */
export function tryBuildUpiIntent(request: UpiPaymentRequest): string | null {
  try {
    return buildUpiIntent(request);
  } catch {
    return null;
  }
}
