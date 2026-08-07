import { describePlanPeriod, toDateString } from "@/lib/plan-period";

/**
 * Nightly subscription lifecycle sweep.
 *
 * Renewals are not auto-charged: a Razorpay order is one-off, so every owner
 * pays each cycle by hand. Nothing was moving `plan_status` off `active` when
 * that stopped happening, which meant console MRR kept counting owners who had
 * long since stopped paying. This marks those accounts `past_due` once their
 * buffer window is fully spent.
 *
 * It deliberately does not touch access, tier or data. Being past due is a
 * billing state and a reporting signal, not a punishment.
 */

type Row = {
  admin_id: string;
  plan_status: string;
  current_period_end: string;
};

export type LifecycleResult = {
  today: string;
  /** Accounts examined. */
  scanned: number;
  /** Accounts whose buffer has run out and were not already past_due. */
  lapsed: number;
  /** Accounts written. Zero on a dry run. */
  updated: number;
  dryRun: boolean;
  errors: string[];
};

export async function runPlanLifecycle(options?: {
  /** Override for testing. Defaults to the real current date. */
  today?: string;
  dryRun?: boolean;
}): Promise<LifecycleResult> {
  const dryRun = options?.dryRun === true;
  const now = options?.today ? new Date(`${options.today}T12:00:00Z`) : new Date();
  const today = toDateString(now);
  const errors: string[] = [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("admin_id, plan_status, current_period_end");
  if (error) {
    console.error("[plan-lifecycle] could not read settings", error);
    throw new Error("Unable to load subscription settings");
  }

  const rows = (data ?? []) as Row[];
  const toMark: string[] = [];

  for (const row of rows) {
    // Already past due, or cancelled by hand in the console: leave it alone.
    if (row.plan_status === "past_due") continue;
    try {
      const period = describePlanPeriod({
        periodEnd: row.current_period_end,
        planStatus: row.plan_status,
        now,
      });
      if (period.isOverdue) toMark.push(row.admin_id);
    } catch (e) {
      // One unparseable date must not stop the sweep for everyone else.
      errors.push(`${row.admin_id}: ${e instanceof Error ? e.message : "bad period end"}`);
    }
  }

  let updated = 0;
  if (toMark.length > 0 && !dryRun) {
    // Chunked so a large account list cannot outgrow the URL length limit of a
    // single `in` filter.
    for (let i = 0; i < toMark.length; i += 100) {
      const chunk = toMark.slice(i, i + 100);
      const { error: upErr } = await supabaseAdmin
        .from("settings")
        .update({ plan_status: "past_due" })
        .in("admin_id", chunk);
      if (upErr) {
        errors.push(`update failed for ${chunk.length} accounts: ${upErr.message}`);
        continue;
      }
      updated += chunk.length;
    }
  }

  return {
    today,
    scanned: rows.length,
    lapsed: toMark.length,
    updated,
    dryRun,
    errors,
  };
}
