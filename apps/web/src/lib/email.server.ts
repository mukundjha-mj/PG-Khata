import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatDate, formatMoney } from "@/lib/pg";

const RESEND_API_URL = "https://api.resend.com";

export type BillEmailData = {
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  monthLabel: string;
  totalAmount: number;
  paidAmount: number;
  rentAmount: number;
  electricityAmount: number;
  electricityUnits: number;
  dueDate: string | null;
  updated: boolean;
};

export function buildBillEmailSubject(data: BillEmailData): string {
  return data.updated
    ? `Updated bill for ${data.monthLabel} - ${data.propertyName}`
    : `Your ${data.monthLabel} bill - ${data.propertyName}`;
}

export function buildBillEmailHtml(data: BillEmailData): string {
  const balance = data.totalAmount - data.paidAmount;
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:8px 0;color:#4b5563;font-size:14px;">${label}</td>
      <td style="padding:8px 0;text-align:right;font-size:14px;${strong ? "font-weight:600;color:#111827;" : "color:#111827;"}">${value}</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h1 style="margin:0 0 4px;font-size:18px;color:#111827;">
      ${data.updated ? "Your bill has been updated" : "Your bill is ready"}
    </h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      ${data.propertyName} · Room ${data.roomNumber} · ${data.monthLabel}
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#111827;">Hi ${data.tenantName},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
      ${
        data.updated
          ? `We re-checked your ${data.monthLabel} charges and issued a corrected bill. The revised details are below.`
          : `Here are your ${data.monthLabel} charges.`
      }
    </p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:16px;">
      ${row("Rent", formatMoney(data.rentAmount))}
      ${row(`Electricity (${data.electricityUnits} units)`, formatMoney(data.electricityAmount))}
      ${row("Total", formatMoney(data.totalAmount), true)}
      ${data.paidAmount > 0 ? row("Already paid", formatMoney(data.paidAmount)) : ""}
      ${row("Balance due", formatMoney(balance), true)}
      ${data.dueDate ? row("Due date", formatDate(data.dueDate)) : ""}
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      Please pay before the due date. Reply to this email if anything looks wrong.
    </p>
  </div>
</body></html>`;
}

/**
 * Sends one email through the Resend API and logs the attempt.
 * Returns a reason instead of throwing when email is simply not configured.
 */
export async function sendTenantEmail(
  supabase: SupabaseClient<Database>,
  args: {
    tenantId: string;
    billId?: string | null;
    to: string;
    subject: string;
    html: string;
    messageType: Database["public"]["Enums"]["message_type"];
  },
): Promise<{ sent: boolean; reason?: string }> {
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) {
    return { sent: false, reason: "Email is not connected yet." };
  }

  // Falls back to Resend's shared test domain, which only delivers to the
  // account owner. Production sets RESEND_FROM_EMAIL to an address on a domain
  // verified in Resend; anything else is rejected on every send.
  const from = process.env["RESEND_FROM_EMAIL"] ?? "PGKhata <onboarding@resend.dev>";
  let errorMessage: string | null = null;
  let providerId: string | null = null;

  try {
    const res = await fetch(`${RESEND_API_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from, to: [args.to], subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      const body = await res.text();
      errorMessage = `Email provider failed [${res.status}]: ${body.slice(0, 300)}`;
    } else {
      const body = (await res.json()) as { id?: string };
      providerId = body.id ?? null;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Email request failed";
  }

  await supabase.from("notification_logs").insert({
    tenant_id: args.tenantId,
    bill_id: args.billId ?? null,
    channel: "email",
    message_type: args.messageType,
    status: errorMessage ? "failed" : "sent",
    provider_message_id: providerId,
    error_message: errorMessage,
  });

  return errorMessage ? { sent: false, reason: errorMessage } : { sent: true };
}
