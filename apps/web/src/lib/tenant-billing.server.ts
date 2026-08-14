import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addDays, cycleFor } from "@/lib/billing-run.server";

export type TenantBillPreview = {
  tenantId: string;
  month: string;
  tenantName: string;
  roomNumber: string;
  propertyId: string;
  propertyName: string;
  rentAmount: number;
  electricityUnits: number;
  electricityRate: number;
  electricityAmount: number;
  otherCharges: { label: string; amount: number }[];
  otherTotal: number;
  totalAmount: number;
  dueDate: string;
  cycleStart: string;
  cycleEnd: string;
  /** Existing bill for this tenant + month, if one is already issued. */
  existing: {
    id: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
  } | null;
};

export type TenantBillRerunResult = {
  action: "created" | "updated";
  billId: string;
  totalAmount: number;
  status: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type Client = SupabaseClient<Database>;

/**
 * Recomputes what a single tenant's bill for `month` should look like.
 *
 * Reads go through the caller's RLS-scoped client, so a tenant belonging to
 * another admin simply resolves to "not found". Nothing is written here.
 */
export async function previewTenantBill(
  supabase: Client,
  tenantId: string,
  month: string,
): Promise<TenantBillPreview> {
  const { start, end } = cycleFor(month);

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, full_name, room_id, monthly_rent_override, status")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw new Error(tenantError.message);
  if (!tenant) throw new Error("Tenant not found.");

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_number, property_id, monthly_rent")
    .eq("id", tenant.room_id)
    .maybeSingle();
  if (roomError) throw new Error(roomError.message);
  if (!room) throw new Error("This tenant has no room assigned.");

  const [property, settings, readings, roommates, existingBill] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, electricity_rate_per_unit")
      .eq("id", room.property_id)
      .maybeSingle(),
    supabase
      .from("settings")
      .select("electricity_rate_per_unit, due_date_offset_days")
      .maybeSingle(),
    supabase
      .from("electricity_readings")
      .select("units_consumed_since_previous")
      .eq("room_id", room.id)
      .gte("reading_date", start)
      .lte("reading_date", end),
    supabase.from("tenants").select("id").eq("room_id", room.id).eq("status", "active"),
    supabase
      .from("bills")
      .select("id, total_amount, paid_amount, status, other_charges")
      .eq("tenant_id", tenantId)
      .eq("bill_month", month)
      .maybeSingle(),
  ]);

  for (const r of [property, settings, readings, roommates, existingBill]) {
    if (r.error) throw new Error(r.error.message);
  }
  if (!property.data) throw new Error("Property not found for this tenant's room.");

  const rate = Number(
    property.data?.electricity_rate_per_unit ?? settings.data?.electricity_rate_per_unit ?? 0,
  );
  const dueOffset = Number(settings.data?.due_date_offset_days ?? 10);

  const roomUnits = (readings.data ?? []).reduce(
    (sum, r) => sum + Math.max(0, Number(r.units_consumed_since_previous ?? 0)),
    0,
  );
  const sharers = Math.max(1, (roommates.data ?? []).length);
  const units = round2(roomUnits / sharers);
  const electricity = round2(units * rate);
  const rent = Number(tenant.monthly_rent_override ?? room.monthly_rent ?? 0);

  // Manual line items on an existing bill survive a re-run.
  const raw = existingBill.data?.other_charges;
  const otherCharges = Array.isArray(raw)
    ? (raw as unknown[])
        .map((item) => {
          const entry = (item ?? {}) as { label?: unknown; amount?: unknown };
          return {
            label: typeof entry.label === "string" ? entry.label : "Other charges",
            amount: Number(entry.amount ?? 0) || 0,
          };
        })
        .filter((item) => item.amount !== 0)
    : [];
  const otherTotal = round2(otherCharges.reduce((s, c) => s + c.amount, 0));

  return {
    tenantId,
    month,
    tenantName: tenant.full_name,
    roomNumber: room.room_number,
    propertyId: property.data.id,
    propertyName: property.data.name,
    rentAmount: rent,
    electricityUnits: units,
    electricityRate: rate,
    electricityAmount: electricity,
    otherCharges,
    otherTotal,
    totalAmount: round2(rent + electricity + otherTotal),
    dueDate: addDays(end, dueOffset),
    cycleStart: start,
    cycleEnd: end,
    existing: existingBill.data
      ? {
          id: existingBill.data.id,
          totalAmount: Number(existingBill.data.total_amount),
          paidAmount: Number(existingBill.data.paid_amount),
          status: String(existingBill.data.status),
        }
      : null,
  };
}

/**
 * Re-runs billing for exactly one tenant + month.
 *
 * Only that tenant's row is touched - the write is filtered on
 * (tenant_id, bill_month), so other tenants' bills for the same month are
 * never read, updated or deleted. Bills with recorded payments require
 * `force` and keep their paid amount, with status recomputed against the
 * new total.
 */
export async function rerunTenantBill(
  supabase: Client,
  tenantId: string,
  month: string,
  force = false,
): Promise<TenantBillRerunResult> {
  const preview = await previewTenantBill(supabase, tenantId, month);
  const existing = preview.existing;

  if (existing && existing.paidAmount > 0 && !force) {
    throw new Error(
      "This bill already has payments recorded. Confirm the re-run to keep the paid amount and update the charges.",
    );
  }

  const paid = existing?.paidAmount ?? 0;
  const status =
    paid <= 0
      ? ("pending" as const)
      : paid >= preview.totalAmount
        ? ("paid" as const)
        : ("partially-paid" as const);

  const row = {
    tenant_id: tenantId,
    property_id: preview.propertyId,
    bill_month: month,
    billing_cycle_start: preview.cycleStart,
    billing_cycle_end: preview.cycleEnd,
    rent_amount: preview.rentAmount,
    electricity_amount: preview.electricityAmount,
    electricity_units_consumed: preview.electricityUnits || null,
    other_charges: preview.otherCharges,
    total_amount: preview.totalAmount,
    due_date: preview.dueDate,
    status,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("bills")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      action: "updated",
      billId: data?.id ?? existing.id,
      totalAmount: preview.totalAmount,
      status,
    };
  }

  const { data, error } = await supabase.from("bills").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return {
    action: "created",
    billId: data?.id ?? "",
    totalAmount: preview.totalAmount,
    status,
  };
}
