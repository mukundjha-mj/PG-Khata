import { formatDate, formatMoney } from "@/lib/pg";

export type ReminderKind = "before-due" | "on-due" | "overdue";

export type ReminderData = {
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  monthLabel: string;
  balance: number;
  dueDate: string | null;
  kind: ReminderKind;
  daysOverdue: number;
  /** Direct owner-collection link. Absent when the owner has set no UPI ID. */
  upiIntent?: string;
};

/**
 * Tenant and property names are owner-supplied and land inside an HTML email,
 * so they cannot be interpolated raw.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function headline(d: ReminderData): string {
  if (d.kind === "before-due") {
    return d.dueDate
      ? `Your ${d.monthLabel} bill is due on ${formatDate(d.dueDate)}.`
      : `Your ${d.monthLabel} bill is due soon.`;
  }
  if (d.kind === "on-due") return `Your ${d.monthLabel} bill is due today.`;
  return `Your ${d.monthLabel} bill is overdue by ${d.daysOverdue} day${d.daysOverdue === 1 ? "" : "s"}.`;
}

export function buildReminderSubject(d: ReminderData): string {
  if (d.kind === "before-due") return `Reminder: ${d.monthLabel} rent due soon - ${d.propertyName}`;
  if (d.kind === "on-due") return `Rent due today - ${d.monthLabel} · ${d.propertyName}`;
  return `Overdue: ${d.monthLabel} rent - ${d.propertyName}`;
}

export function buildReminderMessage(d: ReminderData): string {
  return [
    `Hi ${d.tenantName},`,
    "",
    headline(d),
    `${d.propertyName} · Room ${d.roomNumber}`,
    `Balance due: ${formatMoney(d.balance)}`,
    d.dueDate ? `Due date: ${formatDate(d.dueDate)}` : null,
    d.upiIntent ? "" : null,
    d.upiIntent ? `Pay by UPI: ${d.upiIntent}` : null,
    "",
    d.kind === "overdue"
      ? "Please clear the balance at the earliest. Reply here if you have already paid."
      : "Please pay on or before the due date. Reply here if anything looks wrong.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildReminderEmailHtml(d: ReminderData): string {
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:8px 0;color:#4b5563;font-size:14px;">${label}</td>
      <td style="padding:8px 0;text-align:right;font-size:14px;${strong ? "font-weight:600;color:#111827;" : "color:#111827;"}">${value}</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h1 style="margin:0 0 4px;font-size:18px;color:#111827;">
      ${d.kind === "overdue" ? "Payment overdue" : "Payment reminder"}
    </h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      ${escapeHtml(d.propertyName)} · Room ${escapeHtml(d.roomNumber)} · ${escapeHtml(d.monthLabel)}
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#111827;">Hi ${escapeHtml(d.tenantName)},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">${escapeHtml(headline(d))}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:16px;">
      ${row("Balance due", formatMoney(d.balance), true)}
      ${d.dueDate ? row("Due date", formatDate(d.dueDate)) : ""}
    </table>
    ${
      d.upiIntent
        ? `<a href="${escapeHtml(d.upiIntent)}" style="display:block;padding:12px 16px;margin-bottom:16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;text-align:center;font-size:15px;font-weight:600;">Pay ${formatMoney(d.balance)} by UPI</a>
    <p style="margin:0 0 16px;font-size:12px;color:#6b7280;text-align:center;">
      Opens your UPI app with the amount filled in. Paid directly to your PG owner.
    </p>`
        : ""
    }
    <p style="margin:0;font-size:13px;color:#6b7280;">
      Reply to this email if you have already paid or something looks wrong.
    </p>
  </div>
</body></html>`;
}

/** Template name that must be approved in the Meta Business account. */
export const REMINDER_TEMPLATE_NAME = "rent_payment_reminder";

/**
 * Maps a reminder onto the approved WhatsApp template's named body variables.
 *
 * Meta rejects free-form text for business-initiated messages, so the wording
 * lives in the approved template and only these substitutions vary. Keys must
 * match the template exactly - see the submitted body text below.
 *
 * Template body as submitted:
 *   *Payment Reminder*
 *
 *   Hi {{tenant_name}},
 *
 *   your rent for {{month}} at {{property_room}} is {{amount}}.
 *
 *   Due: {{due_date}}.
 *
 *   Please make sure to pay on or before the due date to avoid any
 *   inconvenience.
 */
export function buildReminderTemplate(d: ReminderData): {
  name: string;
  languageCode: string;
  namedParameters: Record<string, string>;
} {
  return {
    name: REMINDER_TEMPLATE_NAME,
    languageCode: "en",
    namedParameters: {
      tenant_name: d.tenantName,
      month: d.monthLabel,
      property_room: `${d.propertyName} Room ${d.roomNumber}`,
      amount: formatMoney(d.balance),
      due_date: d.dueDate ? formatDate(d.dueDate) : "as soon as possible",
    },
  };
}
