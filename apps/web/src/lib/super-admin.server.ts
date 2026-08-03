import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

/** Throws unless the caller holds the super_admin role. */
export async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) {
    console.error("[super-admin] role check failed", error);
    throw new Error("Unable to verify permissions");
  }
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin as Admin;
}

/** Every owner account with its plan and portfolio size. */
export async function loadAccounts(db: Admin): Promise<AccountRow[]> {
  const [admins, settings, properties, rooms, tenants, roles] = await Promise.all([
    db.from("admins").select("id, name, email, phone, created_at").order("created_at"),
    db
      .from("settings")
      .select("admin_id, plan, plan_status, pending_plan, current_period_end, brand_name"),
    db.from("properties").select("id, admin_id"),
    db.from("rooms").select("id, property_id"),
    db.from("tenants").select("id, room_id, status"),
    db.from("user_roles").select("user_id, role").eq("role", "super_admin"),
  ]);

  const err = admins.error || settings.error || properties.error || rooms.error || tenants.error || roles.error;
  if (err) {
    console.error("[super-admin] load failed", err);
    throw new Error("Unable to load accounts");
  }

  const settingsBy = new Map((settings.data ?? []).map((s) => [s.admin_id, s]));
  const superIds = new Set((roles.data ?? []).map((r) => r.user_id));
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
      brand_name: s?.brand_name ?? "PG Manager",
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

/** Grants or removes the super admin role for an account. */
export async function setSuperAdmin(db: Admin, adminId: string, enabled: boolean) {
  if (enabled) {
    const { error } = await db
      .from("user_roles")
      .upsert({ user_id: adminId, role: "super_admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error("Unable to grant super admin");
  } else {
    const { error } = await db
      .from("user_roles")
      .delete()
      .eq("user_id", adminId)
      .eq("role", "super_admin");
    if (error) throw new Error("Unable to remove super admin");
  }
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

const planPrice: Record<string, number> = { starter: 499, growing: 799, scale: 1499 };

/** Platform-wide research numbers across every owner account. */
export async function loadPlatformStats(db: Admin): Promise<PlatformStats> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [admins, settings, properties, rooms, tenants, bills, payments, planPayments] =
    await Promise.all([
      db.from("admins").select("id, created_at"),
      db.from("settings").select("admin_id, plan, plan_status"),
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
      mrr += planPrice[s.plan] ?? 0;
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

