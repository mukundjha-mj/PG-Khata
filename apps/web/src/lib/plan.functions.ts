import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { computeProration, type BillingCycle } from "@/lib/plan-proration";
import {
  describePlanPeriod,
  formatDate,
  nextPeriod,
  CYCLE_DAYS,
  ANNUAL_CYCLE_DAYS,
} from "@/lib/plan-period";
import { planRank, tierByKey } from "@/lib/pricing-plans";
import { getWhatsAppQuotaStatus, type QuotaStatus } from "@/lib/whatsapp-quota.server";

type SettingsRow = {
  plan: string;
  plan_status: string;
  current_period_start: string;
  current_period_end: string;
  pending_plan: string | null;
  billing_cycle: BillingCycle;
};

const validPlan = (p: unknown) => {
  const key = String(p ?? "");
  if (!["starter", "growing", "scale"].includes(key)) throw new Error("Unknown plan");
  return key;
};

const validCycle = (c: unknown): BillingCycle | undefined => {
  if (c === undefined || c === null) return undefined;
  if (c === "monthly" || c === "annual") return c;
  throw new Error("Unknown billing cycle");
};

/** Amount and cycle length for one tier at the given cadence. */
function cyclePricing(tier: { amount: number; annualAmount?: number }, cycle: BillingCycle) {
  return cycle === "annual"
    ? { amount: tier.annualAmount ?? tier.amount, cycleDays: ANNUAL_CYCLE_DAYS }
    : { amount: tier.amount, cycleDays: CYCLE_DAYS };
}

async function loadSettings(
  supabase: SupabaseClient<Database>,
  adminId: string,
): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("settings")
    .select(
      "plan, plan_status, current_period_start, current_period_end, pending_plan, billing_cycle",
    )
    .eq("admin_id", adminId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Settings not found");
  return data as SettingsRow;
}

/**
 * Starts a renewal for the next billing cycle. Charges the full cycle at list
 * price, so there is no proration: this buys a fresh cycle rather than changing
 * tier mid-cycle. A scheduled downgrade is honoured here, which is the point at
 * which it takes effect. Defaults to whatever cadence the account is already
 * on, so a plain "renew" never silently switches monthly to annual or back.
 */
export const startPlanRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billingCycle?: string } = {}) => ({
    billingCycle: validCycle(input.billingCycle),
  }))
  .handler(async ({ data, context }) => {
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
    const billingCycle = data.billingCycle ?? settings.billing_cycle ?? "monthly";
    const { amount, cycleDays } = cyclePricing(tier, billingCycle);
    const upcoming = nextPeriod({ periodEnd: settings.current_period_end, cycleDays });

    const { createRazorpayOrder, razorpayCreds } = await import("@/lib/plan-checkout.server");
    const { keyId } = razorpayCreds();
    const order = await createRazorpayOrder({
      amountInPaise: Math.round(amount * 100),
      receipt: `rnw_${userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        admin_id: userId,
        to_plan: targetPlan,
        kind: "renewal",
        billing_cycle: billingCycle,
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: payErr } = await supabaseAdmin.from("plan_payments").insert({
      admin_id: userId,
      target_plan: targetPlan,
      amount,
      billing_cycle: billingCycle,
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
      billingCycle,
      /** What the cycle becomes once this payment lands. */
      nextPeriodEnd: upcoming.end,
    };
  });

/** Starts a plan change. Downgrades apply at renewal, upgrades return a Razorpay order. */
export const startPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { toPlan: string; billingCycle?: string }) => ({
    toPlan: validPlan(input.toPlan),
    billingCycle: validCycle(input.billingCycle),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const settings = await loadSettings(supabase, userId);
    // A tier change stays on whatever cadence the account is already paying -
    // switching monthly/annual itself only happens at renewal (see plan doc).
    const billingCycle = data.billingCycle ?? settings.billing_cycle ?? "monthly";

    const proration = computeProration({
      from: settings.plan,
      to: data.toPlan,
      periodStart: settings.current_period_start,
      periodEnd: settings.current_period_end,
      billingCycle,
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
        billing_cycle: billingCycle,
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
        billing_cycle: billingCycle,
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
      billing_cycle: billingCycle,
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

/**
 * Confirms a payment from the browser callback so the page updates immediately.
 *
 * The Razorpay webhook is the authoritative path and applies the same payment
 * through the same code; whichever arrives first wins and the other is a no-op.
 * The two guards here are the ones the webhook cannot make: the checkout
 * signature the client returned, and that the order belongs to this account.
 */
export const confirmPlanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; paymentId: string; signature: string }) => ({
    orderId: String(input.orderId),
    paymentId: String(input.paymentId),
    signature: String(input.signature),
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { verifyRazorpaySignature } = await import("@/lib/plan-checkout.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Scoped to this account, so one owner cannot confirm another's order.
    const { data: payment, error } = await supabaseAdmin
      .from("plan_payments")
      .select("id, status")
      .eq("provider_order_id", data.orderId)
      .eq("admin_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!payment) throw new Error("Payment record not found");

    if (!verifyRazorpaySignature(data)) {
      // neq guards a payment the webhook already confirmed: a bad client
      // signature must not be able to flip a captured payment to failed.
      await supabaseAdmin
        .from("plan_payments")
        .update({ status: "failed", provider_payment_id: data.paymentId })
        .eq("id", payment.id)
        .neq("status", "paid");
      throw new Error("Payment could not be verified");
    }

    const { applyPaidPayment } = await import("@/lib/plan-apply.server");
    const result = await applyPaidPayment({
      orderId: data.orderId,
      paymentId: data.paymentId,
      source: "browser",
    });

    return {
      ok: true as const,
      plan: result.plan,
      ...(result.periodEnd ? { periodEnd: result.periodEnd } : {}),
    };
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

/**
 * Redeems a trial coupon code for the caller's own account. The heavy lifting
 * (validating the code, one redemption per account, writing plan/plan_status)
 * happens inside the `redeem_coupon` SECURITY DEFINER function, so this is
 * just an authenticated pass-through - the plan columns it writes are
 * otherwise locked to the service role.
 */
export const redeemCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim() }))
  .handler(async ({ data, context }) => {
    if (!data.code) throw new Error("Enter a coupon code");
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("redeem_coupon", { _code: data.code });
    if (error) throw new Error(error.message);
    return result as { ok: true; plan: string; trial_days: number };
  });

/**
 * This admin's WhatsApp send usage for the current quota window. Reads the
 * caller's own settings row for `plan`/`plan_updated_at`, so the window
 * always matches what checkWhatsAppQuota would gate on at send time.
 */
export const getMyWhatsAppQuotaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuotaStatus> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("settings")
      .select("plan, plan_updated_at")
      .eq("admin_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { used: 0, limit: null, remaining: null };

    const tier = tierByKey(data.plan ?? "starter");
    return getWhatsAppQuotaStatus(supabase, userId, tier, data.plan_updated_at);
  });
