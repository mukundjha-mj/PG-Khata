import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BRAND } from "@/lib/site";
import { tierByKey } from "@/lib/pricing-plans";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  plan: string;
  plan_status: string;
  pending_plan: string | null;
  current_period_end: string | null;
  brand_name: string;
  properties: number;
  rooms: number;
  tenants: number;
  is_super_admin: boolean;
};

type Admin = SupabaseClient<Database>;

/** Every owner account with its plan and portfolio size. */
export async function loadAccounts(db: Admin): Promise<AccountRow[]> {
  const [admins, settings, properties, rooms, tenants, superAdmins] = await Promise.all([
    db.from("admins").select("id, name, email, phone, created_at").order("created_at"),
    db
      .from("settings")
      .select("admin_id, plan, plan_status, pending_plan, current_period_end, brand_name"),
    db.from("properties").select("id, admin_id"),
    db.from("rooms").select("id, property_id"),
    db.from("tenants").select("id, room_id, status"),
    db.from("super_admins").select("id"),
  ]);

  const err =
    admins.error ||
    settings.error ||
    properties.error ||
    rooms.error ||
    tenants.error ||
    superAdmins.error;
  if (err) {
    console.error("[super-admin] load failed", err);
    throw new Error("Unable to load accounts");
  }

  const settingsBy = new Map((settings.data ?? []).map((s) => [s.admin_id, s]));
  const superIds = new Set((superAdmins.data ?? []).map((s) => s.id));
  const propOwner = new Map((properties.data ?? []).map((p) => [p.id, p.admin_id]));
  const roomOwner = new Map(
    (rooms.data ?? []).map((r) => [r.id, propOwner.get(r.property_id) ?? null] as const),
  );

  const roomCount = new Map<string, number>();
  for (const r of rooms.data ?? []) {
    const owner = propOwner.get(r.property_id);
    if (owner) roomCount.set(owner, (roomCount.get(owner) ?? 0) + 1);
  }
  const tenantCount = new Map<string, number>();
  for (const t of tenants.data ?? []) {
    if (t.status !== "active") continue;
    const owner = roomOwner.get(t.room_id);
    if (owner) tenantCount.set(owner, (tenantCount.get(owner) ?? 0) + 1);
  }
  const propCount = new Map<string, number>();
  for (const p of properties.data ?? []) {
    propCount.set(p.admin_id, (propCount.get(p.admin_id) ?? 0) + 1);
  }

  return (admins.data ?? []).map((a) => {
    const s = settingsBy.get(a.id);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      created_at: a.created_at,
      plan: s?.plan ?? "starter",
      plan_status: s?.plan_status ?? "trial",
      pending_plan: s?.pending_plan ?? null,
      current_period_end: s?.current_period_end ?? null,
      brand_name: s?.brand_name ?? BRAND,
      properties: propCount.get(a.id) ?? 0,
      rooms: roomCount.get(a.id) ?? 0,
      tenants: tenantCount.get(a.id) ?? 0,
      is_super_admin: superIds.has(a.id),
    };
  });
}

/** Overrides an account's plan without charging, recording it in plan history. */
export async function overridePlan(db: Admin, adminId: string, plan: string) {
  const { data: current, error: readErr } = await db
    .from("settings")
    .select("plan")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (readErr) throw new Error("Unable to read current plan");

  const from = current?.plan ?? "starter";
  const { error } = await db
    .from("settings")
    .update({
      plan,
      pending_plan: null,
      plan_status: "active",
      plan_updated_at: new Date().toISOString(),
    })
    .eq("admin_id", adminId);
  if (error) throw new Error("Unable to update plan");

  await db.from("plan_change_history").insert({
    admin_id: adminId,
    from_plan: from,
    to_plan: plan,
    direction: from === plan ? "upgrade" : "upgrade",
    amount: 0,
    credit_applied: 0,
    days_remaining: 0,
    note: "Plan set by super admin. No charge was collected.",
  });

  return { ok: true as const };
}

/** Cancels an owner's subscription immediately, cutting off access right away. */
export async function cancelSubscription(db: Admin, adminId: string, reason: string) {
  const { data: current, error: readErr } = await db
    .from("settings")
    .select("plan")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (readErr) throw new Error("Unable to read current plan");

  const { error } = await db
    .from("settings")
    .update({ plan_status: "cancelled", pending_plan: null })
    .eq("admin_id", adminId);
  if (error) throw new Error("Unable to cancel subscription");

  await db.from("plan_change_history").insert({
    admin_id: adminId,
    from_plan: current?.plan ?? "starter",
    to_plan: current?.plan ?? "starter",
    direction: "cancellation",
    amount: 0,
    credit_applied: 0,
    days_remaining: 0,
    note: reason,
  });

  return { ok: true as const };
}

export type RefundResult = {
  refundReference: string;
  refundedAmount: number;
  remainingRefundable: number;
};

/** Refunds part or all of a captured plan payment via Razorpay, and records it. */
export async function refundOwnerPayment(
  db: Admin,
  input: { adminId: string; planPaymentId: string; amountInPaise: number; reason: string },
): Promise<RefundResult> {
  const { data: payment, error: readErr } = await db
    .from("plan_payments")
    .select("id, admin_id, amount, status, provider_payment_id, refunded_amount, target_plan")
    .eq("id", input.planPaymentId)
    .maybeSingle();
  if (readErr) throw new Error("Unable to read payment");
  if (!payment || payment.admin_id !== input.adminId) throw new Error("Payment not found");
  if (payment.status !== "paid") throw new Error("Only captured payments can be refunded");
  if (!payment.provider_payment_id) throw new Error("Payment has no provider reference");

  const alreadyRefunded = Number(payment.refunded_amount ?? 0);
  const remainingPaise = Math.round((Number(payment.amount) - alreadyRefunded) * 100);
  if (input.amountInPaise <= 0 || input.amountInPaise > remainingPaise) {
    throw new Error("Refund amount exceeds what remains on this payment");
  }

  const { createRazorpayRefund } = await import("@/lib/plan-checkout.server");
  const refund = await createRazorpayRefund({
    paymentId: payment.provider_payment_id,
    amountInPaise: input.amountInPaise,
    notes: { reason: input.reason, admin_id: input.adminId },
  });

  const refundedAmount = alreadyRefunded + input.amountInPaise / 100;
  const { error } = await db
    .from("plan_payments")
    .update({
      refunded_amount: refundedAmount,
      refunded_at: new Date().toISOString(),
      refund_reference: refund.id,
    })
    .eq("id", input.planPaymentId);
  if (error) throw new Error("Refund succeeded but the record could not be updated");

  await db.from("plan_change_history").insert({
    admin_id: input.adminId,
    from_plan: payment.target_plan,
    to_plan: payment.target_plan,
    direction: "refund",
    amount: -(input.amountInPaise / 100),
    credit_applied: 0,
    days_remaining: 0,
    note: input.reason,
    payment_id: refund.id,
  });

  return {
    refundReference: refund.id,
    refundedAmount,
    remainingRefundable: Number(payment.amount) - refundedAmount,
  };
}

/** Reactivates a previously cancelled owner account, restoring access. */
export async function reactivateSubscription(db: Admin, adminId: string) {
  const { data: current, error: readErr } = await db
    .from("settings")
    .select("plan")
    .eq("admin_id", adminId)
    .maybeSingle();
  if (readErr) throw new Error("Unable to read current plan");

  const { error } = await db
    .from("settings")
    .update({ plan_status: "active" })
    .eq("admin_id", adminId);
  if (error) throw new Error("Unable to reactivate subscription");

  await db.from("plan_change_history").insert({
    admin_id: adminId,
    from_plan: current?.plan ?? "starter",
    to_plan: current?.plan ?? "starter",
    direction: "reactivation",
    amount: 0,
    credit_applied: 0,
    days_remaining: 0,
    note: "Reactivated by super admin.",
  });

  return { ok: true as const };
}

export type CouponRow = {
  id: string;
  code: string;
  trial_days: number;
  plan_scope: string;
  max_redemptions: number | null;
  redeemed_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

const COUPON_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function generateCouponCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => COUPON_CODE_ALPHABET[b % COUPON_CODE_ALPHABET.length]).join("");
}

/** Creates a new Starter-scoped trial coupon with a random code. */
export async function createCoupon(
  db: Admin,
  adminId: string,
  input: { trialDays: number; maxRedemptions: number | null; expiresAt: string | null },
): Promise<CouponRow> {
  const code = generateCouponCode();
  const { data, error } = await db
    .from("coupons")
    .insert({
      code,
      trial_days: input.trialDays,
      max_redemptions: input.maxRedemptions,
      expires_at: input.expiresAt,
      created_by: adminId,
    })
    .select("*")
    .single();
  if (error) throw new Error("Unable to create coupon");
  return data as CouponRow;
}

/** Every coupon, newest first. */
export async function listCoupons(db: Admin): Promise<CouponRow[]> {
  const { data, error } = await db
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load coupons");
  return (data ?? []) as CouponRow[];
}

/** Turns a coupon off. Past redemptions are untouched. */
export async function deactivateCoupon(db: Admin, couponId: string) {
  const { error } = await db.from("coupons").update({ active: false }).eq("id", couponId);
  if (error) throw new Error("Unable to deactivate coupon");
  return { ok: true as const };
}

export type PlatformStats = {
  owners: number;
  newOwners30d: number;
  payingOwners: number;
  trialOwners: number;
  planCounts: { starter: number; growing: number; scale: number };
  mrr: number;
  properties: number;
  rooms: number;
  activeTenants: number;
  billsThisMonth: number;
  billedThisMonth: number;
  collectedThisMonth: number;
  outstanding: number;
  planRevenueCaptured: number;
};

/** Platform-wide research numbers across every owner account. */
export async function loadPlatformStats(db: Admin): Promise<PlatformStats> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [admins, settings, properties, rooms, tenants, bills, payments, planPayments] =
    await Promise.all([
      db.from("admins").select("id, created_at"),
      db.from("settings").select("admin_id, plan, plan_status, billing_cycle"),
      db.from("properties").select("id"),
      db.from("rooms").select("id"),
      db.from("tenants").select("id, status"),
      db.from("bills").select("id, total_amount, paid_amount, status, created_at"),
      db.from("payments").select("amount, paid_at").gte("paid_at", monthStart),
      db.from("plan_payments").select("amount, status"),
    ]);

  const err =
    admins.error ||
    settings.error ||
    properties.error ||
    rooms.error ||
    tenants.error ||
    bills.error ||
    payments.error ||
    planPayments.error;
  if (err) {
    console.error("[super-admin] stats failed", err);
    throw new Error("Unable to load platform stats");
  }

  const planCounts = { starter: 0, growing: 0, scale: 0 };
  let mrr = 0;
  let payingOwners = 0;
  let trialOwners = 0;
  for (const s of settings.data ?? []) {
    const key = (s.plan ?? "starter") as keyof typeof planCounts;
    if (key in planCounts) planCounts[key] += 1;
    if (s.plan_status === "active") {
      payingOwners += 1;
      const tier = tierByKey(s.plan ?? "starter");
      // An annual subscriber pays once a year, not once a month - normalize
      // to a monthly-equivalent figure so MRR stays comparable across both
      // cadences instead of being skewed by however many owners prepay.
      mrr +=
        s.billing_cycle === "annual" ? (tier.annualAmount ?? tier.amount * 12) / 12 : tier.amount;
    } else if (s.plan_status === "trial") {
      trialOwners += 1;
    }
  }

  const monthBills = (bills.data ?? []).filter((b) => b.created_at >= monthStart);

  return {
    owners: (admins.data ?? []).length,
    newOwners30d: (admins.data ?? []).filter((a) => a.created_at >= since30).length,
    payingOwners,
    trialOwners,
    planCounts,
    mrr,
    properties: (properties.data ?? []).length,
    rooms: (rooms.data ?? []).length,
    activeTenants: (tenants.data ?? []).filter((t) => t.status === "active").length,
    billsThisMonth: monthBills.length,
    billedThisMonth: monthBills.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0),
    collectedThisMonth: (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
    outstanding: (bills.data ?? []).reduce(
      (sum, b) => sum + Math.max(0, Number(b.total_amount ?? 0) - Number(b.paid_amount ?? 0)),
      0,
    ),
    planRevenueCaptured: (planPayments.data ?? [])
      .filter((p) => p.status === "captured" || p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
  };
}
