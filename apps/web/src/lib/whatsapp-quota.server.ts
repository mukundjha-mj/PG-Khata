import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PlanTier } from "@/lib/pricing-plans";

export type QuotaCheck = { allowed: true } | { allowed: false; reason: string };

export type QuotaStatus = {
  used: number;
  /** null = unlimited (no cap on this tier). */
  limit: number | null;
  /** null = unlimited. Never negative. */
  remaining: number | null;
};

/**
 * The window resets on both triggers the founder asked for: the start of the
 * calendar month, and the moment the plan last changed (plan_updated_at is
 * already bumped on every real transition - see plan-apply.server.ts,
 * plan.functions.ts, super-admin.server.ts). Whichever is more recent wins,
 * so an upgrade or downgrade resets the count immediately instead of waiting
 * for the next month.
 */
function windowStart(planUpdatedAt: string | null): string {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const monthStart = startOfMonth.toISOString();
  return planUpdatedAt && planUpdatedAt > monthStart ? planUpdatedAt : monthStart;
}

/**
 * How much of this admin's monthly WhatsApp allowance is used, computed live
 * from notification_logs rather than a stored counter, so it can never drift
 * from what was actually sent. Shared by the send-time gate (checkWhatsAppQuota)
 * and the owner-facing "X of Y used" display, so both always agree.
 */
export async function getWhatsAppQuotaStatus(
  supabase: SupabaseClient<Database>,
  adminId: string,
  tier: PlanTier,
  planUpdatedAt: string | null,
): Promise<QuotaStatus> {
  if (tier.whatsappQuota === null) return { used: 0, limit: null, remaining: null };

  const { count, error } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .eq("channel", "whatsapp")
    .eq("status", "sent")
    .gte("sent_at", windowStart(planUpdatedAt));
  if (error) throw new Error(error.message);

  const used = count ?? 0;
  return { used, limit: tier.whatsappQuota, remaining: Math.max(0, tier.whatsappQuota - used) };
}

/** Whether this admin can send one more WhatsApp message this billing period. */
export async function checkWhatsAppQuota(
  supabase: SupabaseClient<Database>,
  adminId: string,
  tier: PlanTier,
  planUpdatedAt: string | null,
): Promise<QuotaCheck> {
  const status = await getWhatsAppQuotaStatus(supabase, adminId, tier, planUpdatedAt);
  if (status.limit === null || (status.remaining ?? 0) > 0) return { allowed: true };
  return {
    allowed: false,
    reason: `WhatsApp quota reached for this month (${status.limit} on ${tier.name}). Upgrade for more, or wait for next month's reset.`,
  };
}
