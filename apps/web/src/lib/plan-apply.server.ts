import { computeProration } from "@/lib/plan-proration";
import { formatDate, nextPeriod } from "@/lib/plan-period";
import { planRank, tierByKey } from "@/lib/pricing-plans";

/**
 * Applying a captured payment to an account. Shared by the browser callback and
 * the Razorpay webhook, which race each other by design: whichever arrives
 * first wins and the other becomes a no-op.
 *
 * Everything here runs through the service-role client because the webhook has
 * no user session. Every statement is therefore scoped explicitly by admin_id,
 * taken from the payment row rather than from anything the caller passed in.
 */

/**
 * Whether a paid order was a renewal of the existing cycle or an upgrade into a
 * higher tier. An upgrade always targets a strictly higher tier than the plan
 * currently on the account; anything else (same tier, or the lower tier of a
 * scheduled downgrade) is a renewal of the next cycle.
 */
const isRenewalOrder = (currentPlan: string, targetPlan: string) =>
  planRank(targetPlan) <= planRank(currentPlan);

export type ApplyPaymentResult = {
  ok: true;
  plan: string;
  /** Present for renewals: the cycle end this payment bought. */
  periodEnd?: string;
  /** False when the other path had already applied this payment. */
  applied: boolean;
};

export async function applyPaidPayment(input: {
  orderId: string;
  paymentId: string;
  /** Where the call came from, for the audit log only. */
  source: "browser" | "webhook";
}): Promise<ApplyPaymentResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment, error } = await supabaseAdmin
    .from("plan_payments")
    .select("id, admin_id, target_plan, amount, status")
    .eq("provider_order_id", input.orderId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error("Payment record not found");

  const adminId = payment.admin_id;
  const previousStatus = payment.status;

  // Claim the payment before touching the account. The filter on status is what
  // makes this safe: Postgres re-evaluates it after the competing UPDATE
  // commits, so exactly one caller sees a row come back and the loser gets
  // zero. Reading the status first and then writing would let both through.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("plan_payments")
    .update({ status: "paid", provider_payment_id: input.paymentId })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id");
  if (claimErr) throw claimErr;

  if (!claimed || claimed.length === 0) {
    // Already applied by the other path. Not an error: the webhook retries and
    // a re-opened browser tab both land here legitimately.
    return { ok: true, plan: payment.target_plan, applied: false };
  }

  try {
    const { data: settings, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("plan, plan_status, current_period_start, current_period_end, pending_plan")
      .eq("admin_id", adminId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings) throw new Error("Settings not found");

    const renewal = isRenewalOrder(settings.plan, payment.target_plan);
    const now = new Date().toISOString();
    const base = {
      plan: payment.target_plan,
      pending_plan: null,
      plan_status: "active",
      plan_updated_at: now,
      last_payment_amount: payment.amount,
      last_payment_at: now,
    };

    if (renewal) {
      // A renewal buys the next cycle, so the period dates move. An upgrade
      // keeps them: it was already prorated against this cycle.
      const upcoming = nextPeriod({ periodEnd: settings.current_period_end });
      const { error: upErr } = await supabaseAdmin
        .from("settings")
        .update({
          ...base,
          current_period_start: upcoming.start,
          current_period_end: upcoming.end,
        })
        .eq("admin_id", adminId);
      if (upErr) throw upErr;

      const tier = tierByKey(payment.target_plan);
      const moved = settings.plan !== payment.target_plan;
      const { error: hErr } = await supabaseAdmin.from("plan_change_history").insert({
        admin_id: adminId,
        from_plan: settings.plan,
        to_plan: payment.target_plan,
        direction: "renewal",
        amount: payment.amount,
        credit_applied: 0,
        days_remaining: 0,
        note: moved
          ? `Renewed on the ${tier.name} plan, the scheduled change you asked for. Paid up to ${formatDate(upcoming.end)}.`
          : `Renewed ${tier.name}. Paid up to ${formatDate(upcoming.end)}.`,
        payment_id: input.paymentId,
      });
      if (hErr) throw hErr;

      console.info("[plan-apply] renewal applied", {
        source: input.source,
        adminId,
        plan: payment.target_plan,
        periodEnd: upcoming.end,
      });
      return { ok: true, plan: payment.target_plan, periodEnd: upcoming.end, applied: true };
    }

    const proration = computeProration({
      from: settings.plan,
      to: payment.target_plan,
      periodStart: settings.current_period_start,
      periodEnd: settings.current_period_end,
    });

    const { error: upErr } = await supabaseAdmin
      .from("settings")
      .update(base)
      .eq("admin_id", adminId);
    if (upErr) throw upErr;

    const { error: hErr } = await supabaseAdmin.from("plan_change_history").insert({
      admin_id: adminId,
      from_plan: proration.from,
      to_plan: payment.target_plan,
      direction: "upgrade",
      amount: payment.amount,
      credit_applied: proration.creditApplied,
      days_remaining: proration.daysRemaining,
      note: proration.summary,
      payment_id: input.paymentId,
    });
    if (hErr) throw hErr;

    console.info("[plan-apply] upgrade applied", {
      source: input.source,
      adminId,
      plan: payment.target_plan,
    });
    return { ok: true, plan: payment.target_plan, applied: true };
  } catch (applyError) {
    // The money is captured but the account was not updated. Release the claim
    // so a webhook retry can finish the job, otherwise the owner has paid and
    // stays on the old plan with nothing left to trigger a correction.
    const { error: releaseErr } = await supabaseAdmin
      .from("plan_payments")
      .update({ status: previousStatus === "paid" ? "created" : previousStatus })
      .eq("id", payment.id);
    if (releaseErr) {
      console.error("[plan-apply] could not release claim, needs manual repair", {
        paymentRowId: payment.id,
        adminId,
        releaseErr,
      });
    }
    throw applyError;
  }
}
