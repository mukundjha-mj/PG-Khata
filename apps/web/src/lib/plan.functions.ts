import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { computeProration } from "@/lib/plan-proration";
import { describePlanPeriod, formatDate, nextPeriod } from "@/lib/plan-period";
import { planRank, tierByKey } from "@/lib/pricing-plans";

type SettingsRow = {
  plan: string;
  plan_status: string;
  current_period_start: string;
  current_period_end: string;
  pending_plan: string | null;
};

const validPlan = (p: unknown) => {
  const key = String(p ?? "");
  if (!["starter", "growing", "scale"].includes(key)) throw new Error("Unknown plan");
  return key;
};

async function loadSettings(
  supabase: SupabaseClient<Database>,
  adminId: string,
): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("settings")
    .select("plan, plan_status, current_period_start, current_period_end, pending_plan")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Settings not found");
  return data as SettingsRow;
}

/**
 * Whether a paid order was a renewal of the existing cycle or an upgrade into a
 * higher tier. An upgrade always targets a strictly higher tier than the plan
 * currently on the account; anything else (same tier, or the lower tier of a
 * scheduled downgrade) is a renewal of the next cycle.
 *
 * Derived rather than stored so no column has to be backfilled onto orders that
 * were already created before renewals existed.
 */
const isRenewalOrder = (currentPlan: string, targetPlan: string) =>
  planRank(targetPlan) <= planRank(currentPlan);

/**
 * Starts a renewal for the next billing cycle. Charges the full month at list
 * price, so there is no proration: this buys a fresh cycle rather than changing
 * tier mid-cycle. A scheduled downgrade is honoured here, which is the point at
 * which it takes effect.
 */
export const startPlanRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const settings = await loadSettings(supabase, userId);

    const period = describePlanPeriod({
      periodEnd: settings.current_period_end,
      planStatus: settings.plan_status,
    });
    // Renewing far ahead of time would stack cycles and confuse the renewal
    // date, so it only opens once the cycle is actually near its end.
    if (!period.needsPayment) {
      throw new Error(
        `Nothing is due yet. You can renew from ${formatDate(
          settings.current_period_end,
        )}, or closer to it.`,
      );
    }

    // A scheduled downgrade is what the owner asked to be on from this cycle, so
    // it is honoured here. pending_plan is also set while an upgrade checkout is
    // in flight though, and an abandoned one must not quietly bill the higher
    // tier as a renewal: only a genuine downgrade is carried over.
    const scheduled = settings.pending_plan;
    const isScheduledDowngrade = !!scheduled && planRank(scheduled) < planRank(settings.plan);
    const targetPlan = validPlan(isScheduledDowngrade ? scheduled : settings.plan);
    const tier = tierByKey(targetPlan);
    const upcoming = nextPeriod({ periodEnd: settings.current_period_end });

    const { createRazorpayOrder, razorpayCreds } = await import("@/lib/plan-checkout.server");
    const { keyId } = razorpayCreds();
    const order = await createRazorpayOrder({
      amountInPaise: Math.round(tier.amount * 100),
      receipt: `rnw_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { admin_id: userId, to_plan: targetPlan, kind: "renewal" },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: payErr } = await supabaseAdmin.from("plan_payments").insert({
      admin_id: userId,
      target_plan: targetPlan,
      amount: tier.amount,
      provider_order_id: order.id,
      status: "created",
    });
    if (payErr) throw payErr;

    return {
      kind: "checkout" as const,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      planName: tier.name,
      /** What the cycle becomes once this payment lands. */
      nextPeriodEnd: upcoming.end,
    };
  });

/** Starts a plan change. Downgrades apply at renewal, upgrades return a Razorpay order. */
export const startPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { toPlan: string }) => ({ toPlan: validPlan(input.toPlan) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const settings = await loadSettings(supabase, userId);

    const proration = computeProration({
      from: settings.plan,
      to: data.toPlan,
      periodStart: settings.current_period_start,
      periodEnd: settings.current_period_end,
    });

    if (proration.direction === "same") throw new Error("You are already on this plan");

    if (proration.direction === "downgrade") {
      const { error } = await supabase
        .from("settings")
        .update({ pending_plan: data.toPlan, plan_updated_at: new Date().toISOString() })
        .eq("admin_id", userId);
      if (error) throw error;
      await supabase.from("plan_change_history").insert({
        admin_id: userId,
        from_plan: proration.from,
        to_plan: proration.to,
        direction: "downgrade",
        amount: 0,
        credit_applied: proration.creditApplied,
        days_remaining: proration.daysRemaining,
        note: proration.summary,
      });
      return { kind: "scheduled" as const, proration };
    }

    if (proration.amountDue <= 0) {
      const { error } = await supabase
        .from("settings")
        .update({
          plan: data.toPlan,
          pending_plan: null,
          plan_updated_at: new Date().toISOString(),
        })
        .eq("admin_id", userId);
      if (error) throw error;
      await supabase.from("plan_change_history").insert({
        admin_id: userId,
        from_plan: proration.from,
        to_plan: proration.to,
        direction: "upgrade",
        amount: 0,
        credit_applied: proration.creditApplied,
        days_remaining: proration.daysRemaining,
        note: "Upgrade applied with no charge, unused credit covered the difference.",
      });
      return { kind: "applied" as const, proration };
    }

    const { createRazorpayOrder, razorpayCreds } = await import("@/lib/plan-checkout.server");
    const { keyId } = razorpayCreds();
    const order = await createRazorpayOrder({
      amountInPaise: Math.round(proration.amountDue * 100),
      receipt: `plan_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { admin_id: userId, to_plan: data.toPlan, from_plan: proration.from },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: payErr } = await supabaseAdmin.from("plan_payments").insert({
      admin_id: userId,
      target_plan: data.toPlan,
      amount: proration.amountDue,
      provider_order_id: order.id,
      status: "created",
    });
    if (payErr) throw payErr;

    await supabase.from("settings").update({ pending_plan: data.toPlan }).eq("admin_id", userId);

    return {
      kind: "checkout" as const,
      proration,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      planName: tierByKey(data.toPlan).name,
    };
  });

/** Verifies a Razorpay payment and applies the upgrade. */
export const confirmPlanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; paymentId: string; signature: string }) => ({
    orderId: String(input.orderId),
    paymentId: String(input.paymentId),
    signature: String(input.signature),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { verifyRazorpaySignature } = await import("@/lib/plan-checkout.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error } = await supabaseAdmin
      .from("plan_payments")
      .select("*")
      .eq("provider_order_id", data.orderId)
      .eq("admin_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!payment) throw new Error("Payment record not found");

    if (!verifyRazorpaySignature(data)) {
      await supabaseAdmin
        .from("plan_payments")
        .update({ status: "failed", provider_payment_id: data.paymentId })
        .eq("id", payment.id);
      throw new Error("Payment could not be verified");
    }

    if (payment.status === "paid") return { ok: true as const, plan: payment.target_plan };

    const settings = await loadSettings(supabase, userId);
    const renewal = isRenewalOrder(settings.plan, payment.target_plan);

    await supabaseAdmin
      .from("plan_payments")
      .update({ status: "paid", provider_payment_id: data.paymentId })
      .eq("id", payment.id);

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
      const { error: upErr } = await supabase
        .from("settings")
        .update({
          ...base,
          current_period_start: upcoming.start,
          current_period_end: upcoming.end,
        })
        .eq("admin_id", userId);
      if (upErr) throw upErr;

      const tier = tierByKey(payment.target_plan);
      const moved = settings.plan !== payment.target_plan;
      await supabase.from("plan_change_history").insert({
        admin_id: userId,
        from_plan: settings.plan,
        to_plan: payment.target_plan,
        direction: "renewal",
        amount: payment.amount,
        credit_applied: 0,
        days_remaining: 0,
        note: moved
          ? `Renewed on the ${tier.name} plan, the scheduled change you asked for. Paid up to ${formatDate(upcoming.end)}.`
          : `Renewed ${tier.name}. Paid up to ${formatDate(upcoming.end)}.`,
        payment_id: data.paymentId,
      });

      return {
        ok: true as const,
        plan: payment.target_plan as string,
        periodEnd: upcoming.end,
      };
    }

    const proration = computeProration({
      from: settings.plan,
      to: payment.target_plan,
      periodStart: settings.current_period_start,
      periodEnd: settings.current_period_end,
    });

    const { error: upErr } = await supabase.from("settings").update(base).eq("admin_id", userId);
    if (upErr) throw upErr;

    await supabase.from("plan_change_history").insert({
      admin_id: userId,
      from_plan: proration.from,
      to_plan: payment.target_plan,
      direction: "upgrade",
      amount: payment.amount,
      credit_applied: proration.creditApplied,
      days_remaining: proration.daysRemaining,
      note: proration.summary,
      payment_id: data.paymentId,
    });

    return { ok: true as const, plan: payment.target_plan as string };
  });

/** Cancels a scheduled downgrade before it takes effect. */
export const cancelPendingPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("settings")
      .update({ pending_plan: null })
      .eq("admin_id", userId);
    if (error) throw error;
    return { ok: true as const };
  });
