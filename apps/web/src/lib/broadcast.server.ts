import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadAccounts } from "@/lib/super-admin.server";

type Admin = SupabaseClient<Database>;

export const BROADCAST_SEGMENTS = [
  "all",
  "trial",
  "active",
  "starter",
  "growing",
  "scale",
] as const;
export type BroadcastSegment = (typeof BROADCAST_SEGMENTS)[number];

const RESEND_API_URL = "https://api.resend.com";

export type BroadcastRecipient = { id: string; email: string; name: string };

/** Owner accounts matching a broadcast segment, drawn from the same rows the owner directory uses. */
export async function resolveSegmentRecipients(
  db: Admin,
  segment: BroadcastSegment,
): Promise<BroadcastRecipient[]> {
  const accounts = await loadAccounts(db);
  const matches = accounts.filter((a) => {
    switch (segment) {
      case "all":
        return true;
      case "trial":
        return a.plan_status === "trial";
      case "active":
        return a.plan_status === "active";
      case "starter":
      case "growing":
      case "scale":
        return a.plan === segment;
      default:
        return false;
    }
  });
  return matches.filter((a) => a.email).map((a) => ({ id: a.id, email: a.email, name: a.name }));
}

function renderBroadcastHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:14px;color:#111827;">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    ${paragraphs}
  </div>
</body></html>`;
}

/**
 * Sends one platform announcement email through Resend. Not logged to
 * notification_logs - that table is scoped to a tenant_id (NOT NULL) and
 * this targets an owner account, not a tenant.
 */
async function sendOwnerBroadcastEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; reason?: string }> {
  const resendKey = process.env["RESEND_API_KEY"]?.trim();
  if (!resendKey) return { sent: false, reason: "Email is not connected yet." };

  const from = process.env["RESEND_FROM_EMAIL"]?.trim();
  if (!from) return { sent: false, reason: "RESEND_FROM_EMAIL is not set." };

  try {
    const res = await fetch(`${RESEND_API_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return {
        sent: false,
        reason: `Email provider failed [${res.status}]: ${errBody.slice(0, 300)}`,
      };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Email request failed",
    };
  }
}

const SEND_BATCH_SIZE = 10;

export type BroadcastResult = {
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  firstFailureReason: string | null;
};

/** Sends an announcement to every owner in a segment, in small concurrent batches. */
export async function sendBroadcast(
  db: Admin,
  input: { segment: BroadcastSegment; subject: string; body: string },
): Promise<BroadcastResult> {
  const recipients = await resolveSegmentRecipients(db, input.segment);
  const html = renderBroadcastHtml(input.body);

  let sentCount = 0;
  let failedCount = 0;
  let firstFailureReason: string | null = null;

  for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
    const batch = recipients.slice(i, i + SEND_BATCH_SIZE);
    const outcomes = await Promise.all(
      batch.map((r) => sendOwnerBroadcastEmail(r.email, input.subject, html)),
    );
    for (const outcome of outcomes) {
      if (outcome.sent) sentCount += 1;
      else {
        failedCount += 1;
        firstFailureReason ??= outcome.reason ?? null;
      }
    }
  }

  return { recipientCount: recipients.length, sentCount, failedCount, firstFailureReason };
}
