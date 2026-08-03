import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { computeProration } from "@/lib/plan-proration";
import { tierByKey } from "@/lib/pricing-plans";

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
    const proration = computeProration({
      from: settings.plan,
      to: payment.target_plan,
      periodStart: settings.current_period_start,
      periodEnd: settings.current_period_end,
    });

    await supabaseAdmin
      .from("plan_payments")
      .update({ status: "paid", provider_payment_id: data.paymentId })
      .eq("id", payment.id);

    const { error: upErr } = await supabase
      .from("settings")
      .update({
        plan: payment.target_plan,
        pending_plan: null,
        plan_status: "active",
        plan_updated_at: new Date().toISOString(),
        last_payment_amount: payment.amount,
        last_payment_at: new Date().toISOString(),
      })
      .eq("admin_id", userId);
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
