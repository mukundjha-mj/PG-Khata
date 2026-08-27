import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type QuotaCheck = { allowed: true } | { allowed: false; reason: string };

export type QuotaStatus = {
  used: number;
  /** null = unlimited (owner has whatsapp_unlimited = true). */
  limit: number | null;
  /** null = unlimited. Never negative. */
  remaining: number | null;
};

/**
 * The quota window resets at the start of each calendar month.
 * Simple and predictable for MVP — no plan-change reset logic needed.
 */
function windowStart(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * How much of this admin's monthly WhatsApp allowance is used, computed live
 * from notification_logs rather than a stored counter, so it can never drift
 * from what was actually sent.
 *
 * Reads quota configuration from `settings.whatsapp_monthly_limit` and
 * `settings.whatsapp_unlimited` — controlled by the super-admin per owner.
 */
export async function getWhatsAppQuotaStatus(
  supabase: SupabaseClient<Database>,
  adminId: string,
): Promise<QuotaStatus> {
  const { data: settings, error: settingsErr } = await supabase
    .from("settings")
    .select("whatsapp_monthly_limit, whatsapp_unlimited")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (settingsErr) throw new Error(settingsErr.message);

  // Unlimited owner — no cap at all.
  if (settings?.whatsapp_unlimited) {
    // Still count usage for analytics, but report no limit.
    const { count, error } = await supabase
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", adminId)
      .eq("channel", "whatsapp")
      .eq("status", "sent")
      .gte("sent_at", windowStart());
    if (error) throw new Error(error.message);
    return { used: count ?? 0, limit: null, remaining: null };
  }

  const limit = settings?.whatsapp_monthly_limit ?? 50;

  const { count, error } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .eq("channel", "whatsapp")
    .eq("status", "sent")
    .gte("sent_at", windowStart());
  if (error) throw new Error(error.message);

  const used = count ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Whether this admin can send one more WhatsApp message this month.
 * Returns { allowed: true } or { allowed: false, reason } with a
 * user-friendly message that does NOT mention plans or upgrades.
 */
export async function checkWhatsAppQuota(
  supabase: SupabaseClient<Database>,
  adminId: string,
): Promise<QuotaCheck> {
  const status = await getWhatsAppQuotaStatus(supabase, adminId);
  if (status.limit === null || (status.remaining ?? 0) > 0) return { allowed: true };
  return {
    allowed: false,
    reason: `You've reached your monthly WhatsApp allowance (${status.limit} messages). Contact us to request more.`,
  };
}
