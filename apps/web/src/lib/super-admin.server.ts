import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BRAND } from "@/lib/site";
import { DEFAULT_WHATSAPP_MONTHLY_LIMIT } from "@/lib/whatsapp-quota.server";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  brand_name: string;
  properties: number;
  rooms: number;
  tenants: number;
  is_super_admin: boolean;
  whatsapp_monthly_limit: number;
  whatsapp_unlimited: boolean;
  whatsapp_sent_this_month: number;
  whatsapp_remaining: number | null;
};

type Admin = SupabaseClient<Database>;

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Every PG owner with their portfolio and live calendar-month WhatsApp usage. */
export async function loadAccounts(db: Admin): Promise<AccountRow[]> {
  const [admins, settings, properties, rooms, tenants, superAdmins, sentLogs] = await Promise.all([
    db.from("admins").select("id, name, email, phone, created_at").order("created_at"),
    db.from("settings").select("admin_id, brand_name, whatsapp_monthly_limit, whatsapp_unlimited"),
    db.from("properties").select("id, admin_id"),
    db.from("rooms").select("id, property_id"),
    db.from("tenants").select("id, room_id, status"),
    db.from("super_admins").select("id"),
    db
      .from("notification_logs")
      .select("admin_id")
      .eq("channel", "whatsapp")
      .eq("status", "sent")
      .gte("sent_at", monthStart()),
  ]);

  const err =
    admins.error ||
    settings.error ||
    properties.error ||
    rooms.error ||
    tenants.error ||
    superAdmins.error ||
    sentLogs.error;
  if (err) {
    console.error("[super-admin] account load failed", err);
    throw new Error("Unable to load accounts");
  }

  const settingsBy = new Map((settings.data ?? []).map((setting) => [setting.admin_id, setting]));
  const superIds = new Set((superAdmins.data ?? []).map((admin) => admin.id));
  const propertyOwner = new Map(
    (properties.data ?? []).map((property) => [property.id, property.admin_id]),
  );
  const roomOwner = new Map(
    (rooms.data ?? []).map(
      (room) => [room.id, propertyOwner.get(room.property_id) ?? null] as const,
    ),
  );
  const propertyCount = new Map<string, number>();
  const roomCount = new Map<string, number>();
  const tenantCount = new Map<string, number>();
  const sentCount = new Map<string, number>();

  for (const property of properties.data ?? []) {
    propertyCount.set(property.admin_id, (propertyCount.get(property.admin_id) ?? 0) + 1);
  }
  for (const room of rooms.data ?? []) {
    const ownerId = propertyOwner.get(room.property_id);
    if (ownerId) roomCount.set(ownerId, (roomCount.get(ownerId) ?? 0) + 1);
  }
  for (const tenant of tenants.data ?? []) {
    if (tenant.status !== "active") continue;
    const ownerId = roomOwner.get(tenant.room_id);
    if (ownerId) tenantCount.set(ownerId, (tenantCount.get(ownerId) ?? 0) + 1);
  }
  for (const log of sentLogs.data ?? []) {
    if (!log.admin_id) continue;
    sentCount.set(log.admin_id, (sentCount.get(log.admin_id) ?? 0) + 1);
  }

  return (admins.data ?? []).map((admin) => {
    const setting = settingsBy.get(admin.id);
    const limit = setting?.whatsapp_monthly_limit ?? DEFAULT_WHATSAPP_MONTHLY_LIMIT;
    const unlimited = setting?.whatsapp_unlimited ?? false;
    const sent = sentCount.get(admin.id) ?? 0;
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      created_at: admin.created_at,
      brand_name: setting?.brand_name ?? BRAND,
      properties: propertyCount.get(admin.id) ?? 0,
      rooms: roomCount.get(admin.id) ?? 0,
      tenants: tenantCount.get(admin.id) ?? 0,
      is_super_admin: superIds.has(admin.id),
      whatsapp_monthly_limit: limit,
      whatsapp_unlimited: unlimited,
      whatsapp_sent_this_month: sent,
      whatsapp_remaining: unlimited ? null : Math.max(0, limit - sent),
    };
  });
}

export type PlatformStats = {
  owners: number;
  newOwners30d: number;
  properties: number;
  rooms: number;
  activeTenants: number;
  billsThisMonth: number;
  billedThisMonth: number;
  collectedThisMonth: number;
  outstanding: number;
  whatsappSentThisMonth: number;
  quotaReachedOwners: number;
  unlimitedOwners: number;
};

/** Platform operational and quota metrics; subscription and payment-plan data is intentionally excluded. */
export async function loadPlatformStats(db: Admin): Promise<PlatformStats> {
  const now = new Date();
  const start = monthStart();
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [accounts, bills, payments] = await Promise.all([
    loadAccounts(db),
    db.from("bills").select("id, total_amount, paid_amount, created_at"),
    db.from("payments").select("amount, paid_at").gte("paid_at", start),
  ]);
  if (bills.error || payments.error) {
    console.error("[super-admin] stats failed", bills.error || payments.error);
    throw new Error("Unable to load platform stats");
  }

  const billRows = bills.data ?? [];
  const monthBills = billRows.filter((bill) => bill.created_at >= start);
  return {
    owners: accounts.length,
    newOwners30d: accounts.filter((account) => account.created_at >= since30).length,
    properties: accounts.reduce((sum, account) => sum + account.properties, 0),
    rooms: accounts.reduce((sum, account) => sum + account.rooms, 0),
    activeTenants: accounts.reduce((sum, account) => sum + account.tenants, 0),
    billsThisMonth: monthBills.length,
    billedThisMonth: monthBills.reduce((sum, bill) => sum + Number(bill.total_amount ?? 0), 0),
    collectedThisMonth: (payments.data ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    ),
    outstanding: billRows.reduce(
      (sum, bill) =>
        sum + Math.max(0, Number(bill.total_amount ?? 0) - Number(bill.paid_amount ?? 0)),
      0,
    ),
    whatsappSentThisMonth: accounts.reduce(
      (sum, account) => sum + account.whatsapp_sent_this_month,
      0,
    ),
    quotaReachedOwners: accounts.filter(
      (account) => !account.whatsapp_unlimited && account.whatsapp_remaining === 0,
    ).length,
    unlimitedOwners: accounts.filter((account) => account.whatsapp_unlimited).length,
  };
}

/** Global quota applies only to owners created after this value is changed. */
export async function loadGlobalWhatsAppQuota(db: Admin): Promise<number> {
  const { data, error } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "default_whatsapp_quota")
    .maybeSingle();
  if (error) throw new Error("Unable to load the default WhatsApp quota");
  const value = Number(data?.value ?? 50);
  return Number.isInteger(value) && value >= 0 ? value : 50;
}

export async function setGlobalWhatsAppQuota(db: Admin, limit: number): Promise<{ limit: number }> {
  const { error } = await db.from("platform_config").upsert(
    {
      key: "default_whatsapp_quota",
      value: String(limit),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error("Unable to update the default WhatsApp quota");
  return { limit };
}

export async function setOwnerWhatsAppQuota(
  db: Admin,
  input: { adminId: string; monthlyLimit: number; unlimited: boolean },
): Promise<{ previousLimit: number; previousUnlimited: boolean }> {
  const { data: current, error: readError } = await db
    .from("settings")
    .select("whatsapp_monthly_limit, whatsapp_unlimited")
    .eq("admin_id", input.adminId)
    .maybeSingle();
  if (readError) throw new Error("Unable to read the owner's WhatsApp quota");
  if (!current) throw new Error("Owner settings were not found");

  const { error } = await db
    .from("settings")
    .update({
      whatsapp_monthly_limit: input.monthlyLimit,
      whatsapp_unlimited: input.unlimited,
    })
    .eq("admin_id", input.adminId);
  if (error) throw new Error("Unable to update the owner's WhatsApp quota");

  return {
    previousLimit: current.whatsapp_monthly_limit,
    previousUnlimited: current.whatsapp_unlimited,
  };
}
