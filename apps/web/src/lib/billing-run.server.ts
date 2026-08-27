import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BillingRunResult = {
  month: string;
  admins: number;
  candidates: number;
  created: number;
  skipped: number;
  errors: string[];
};

export function cycleFor(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Month currently being billed, e.g. "2026-08". */
export function currentMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Generates rent + electricity bills for every active tenant of every admin.
 *
 * Idempotent on two levels: existing bills for the month are filtered out
 * before insert, and the `bills_tenant_month_unique` index makes concurrent or
 * retried runs impossible to duplicate (conflicts are ignored, not errors).
 *
 * This runs with the service role, so it bypasses RLS. Pass `adminId` to
 * restrict the run to one owner; only the scheduled platform-wide job may omit
 * it. Without it an owner-triggered call would create bills across every
 * account on the platform.
 */
export async function runMonthlyBilling(
  month: string,
  options: { approved?: boolean; adminId?: string } = {},
): Promise<BillingRunResult> {
  // Scheduled runs create bills that wait for admin approval; manual runs are
  // approved on the spot because a human already pressed the button.
  const approved = options.approved !== false;
  const adminId = options.adminId;
  const supabase = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { start, end } = cycleFor(month);
  const result: BillingRunResult = {
    month,
    admins: 0,
    candidates: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  // Walk the ownership chain first so every dependent query is already scoped:
  // admin -> property -> room -> tenant.
  const adminQuery = supabase.from("admins").select("id");
  const admins = await (adminId ? adminQuery.eq("id", adminId) : adminQuery);
  if (admins.error) throw new Error(admins.error.message);
  result.admins = (admins.data ?? []).length;
  if (result.admins === 0) return result;

  const propertyQuery = supabase
    .from("properties")
    .select("id, admin_id, electricity_rate_per_unit");
  const properties = await (adminId ? propertyQuery.eq("admin_id", adminId) : propertyQuery);
  if (properties.error) throw new Error(properties.error.message);
  const propertyIds = (properties.data ?? []).map((p) => p.id);
  if (propertyIds.length === 0) return result;

  const rooms = await supabase
    .from("rooms")
    .select("id, property_id, monthly_rent")
    .in("property_id", propertyIds);
  if (rooms.error) throw new Error(rooms.error.message);
  const roomIds = (rooms.data ?? []).map((r) => r.id);
  if (roomIds.length === 0) return result;

  const tenants = await supabase
    .from("tenants")
    .select("id, room_id, monthly_rent_override, status")
    .in("room_id", roomIds);
  if (tenants.error) throw new Error(tenants.error.message);
  const tenantIds = (tenants.data ?? []).map((t) => t.id);

  const adminIds = (admins.data ?? []).map((a) => a.id);
  const [settings, existing, readings] = await Promise.all([
    supabase
      .from("settings")
      .select("admin_id, electricity_rate_per_unit, due_date_offset_days")
      .in("admin_id", adminIds),
    tenantIds.length > 0
      ? supabase
          .from("bills")
          .select("tenant_id")
          .eq("bill_month", month)
          .in("tenant_id", tenantIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase
      .from("electricity_readings")
      .select("room_id, units_consumed_since_previous")
      .in("room_id", roomIds)
      .gte("reading_date", start)
      .lte("reading_date", end),
  ]);

  for (const r of [settings, existing, readings]) {
    if (r.error) throw new Error(r.error.message);
  }

  const propertyById = new Map((properties.data ?? []).map((p) => [p.id, p]));
  const roomById = new Map((rooms.data ?? []).map((r) => [r.id, r]));
  const settingsByAdmin = new Map((settings.data ?? []).map((s) => [s.admin_id, s]));
  const alreadyBilled = new Set((existing.data ?? []).map((b) => b.tenant_id));

  // Units logged for each room inside this billing cycle.
  const unitsByRoom = new Map<string, number>();
  for (const r of readings.data ?? []) {
    const units = Number(r.units_consumed_since_previous ?? 0);
    if (units > 0) unitsByRoom.set(r.room_id, (unitsByRoom.get(r.room_id) ?? 0) + units);
  }

  const active = (tenants.data ?? []).filter((t) => t.status === "active");

  // Electricity is split evenly between the tenants sharing a room this run.
  const tenantsPerRoom = new Map<string, number>();
  for (const t of active) {
    tenantsPerRoom.set(t.room_id, (tenantsPerRoom.get(t.room_id) ?? 0) + 1);
  }

  const rows = [];
  for (const tenant of active) {
    const room = roomById.get(tenant.room_id);
    const property = room ? propertyById.get(room.property_id) : undefined;
    if (!room || !property) continue;
    result.candidates += 1;

    if (alreadyBilled.has(tenant.id)) {
      result.skipped += 1;
      continue;
    }

    const config = settingsByAdmin.get(property.admin_id);
    const rate = Number(
      property.electricity_rate_per_unit ?? config?.electricity_rate_per_unit ?? 0,
    );
    const offset = Number(config?.due_date_offset_days ?? 10);

    const roomUnits = unitsByRoom.get(room.id) ?? 0;
    const units = round2(roomUnits / (tenantsPerRoom.get(room.id) || 1));
    const electricity = round2(units * rate);
    const rent = Number(tenant.monthly_rent_override ?? room.monthly_rent ?? 0);

    rows.push({
      tenant_id: tenant.id,
      property_id: property.id,
      bill_month: month,
      billing_cycle_start: start,
      billing_cycle_end: end,
      rent_amount: rent,
      electricity_amount: electricity,
      electricity_units_consumed: units || null,
      other_charges: [],
      total_amount: round2(rent + electricity),
      due_date: addDays(end, offset),
      status: "pending" as const,
      approved,
      approved_at: approved ? new Date().toISOString() : null,
    });
  }

  if (rows.length > 0) {
    // ignoreDuplicates keeps concurrent/retried runs safe against the
    // (tenant_id, bill_month) unique index instead of failing the whole batch.
    const { data, error } = await supabase
      .from("bills")
      .upsert(rows, { onConflict: "tenant_id,bill_month", ignoreDuplicates: true })
      .select("id");
    if (error) {
      result.errors.push(error.message);
    } else {
      result.created = data?.length ?? 0;
      result.skipped += rows.length - result.created;

      // Unapproved bills are drafts awaiting admin review - notifying the
      // tenant about a bill that might still change would be premature.
      if (approved) {
        const { notifyTenantAboutBill } = await import("@/lib/bill-notify.server");
        for (const created of data ?? []) {
          await notifyTenantAboutBill(supabase, created.id, { updated: false });
        }
      }
    }
  }

  return result;
}
