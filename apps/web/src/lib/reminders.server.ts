import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildReminderEmailHtml,
  buildReminderMessage,
  buildReminderSubject,
  type ReminderData,
  type ReminderKind,
} from "@/lib/reminder-message";
import { sendTenantEmail } from "@/lib/email.server";

/** Minimum gap between two overdue reminders for the same bill. */
const OVERDUE_EVERY_DAYS = 3;

export type ReminderRunResult = {
  today: string;
  candidates: number;
  matched: number;
  emailSent: number;
  skipped: number;
  markedOverdue: number;
  errors: string[];
  details: Array<{
    billId: string;
    tenant: string;
    kind: ReminderKind;
    email: boolean;
    reason?: string;
  }>;
};

function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Sends payment reminders for every approved, unpaid bill that falls due
 * today, becomes due in `reminder_days_before` days, or is already overdue.
 *
 * Safe to run repeatedly: a bill is never reminded twice on the same day, and
 * overdue reminders respect a cooldown, both derived from notification_logs.
 *
 * This runs with the service role, so it bypasses RLS. Pass `adminId` to
 * restrict the run to one owner; only the scheduled platform-wide job may omit
 * it. Without it an owner-triggered call would email every other owner's
 * tenants and mark their bills overdue.
 */
export async function runPaymentReminders(
  options: { today?: string; dryRun?: boolean; adminId?: string } = {},
): Promise<ReminderRunResult> {
  const supabase = serviceClient();
  const today = options.today ?? todayIso();
  const adminId = options.adminId;
  const result: ReminderRunResult = {
    today,
    candidates: 0,
    matched: 0,
    emailSent: 0,
    skipped: 0,
    markedOverdue: 0,
    errors: [],
    details: [],
  };

  // Scope first: everything downstream is filtered to these properties.
  const propertyQuery = supabase.from("properties").select("id, admin_id, name");
  const propertiesRes = await (adminId
    ? propertyQuery.eq("admin_id", adminId)
    : propertyQuery);
  if (propertiesRes.error) throw new Error(propertiesRes.error.message);
  const ownedPropertyIds = (propertiesRes.data ?? []).map((p) => p.id);
  if (ownedPropertyIds.length === 0) return result;

  const { data: bills, error } = await supabase
    .from("bills")
    .select(
      "id, tenant_id, property_id, bill_month, total_amount, paid_amount, due_date, status, approved",
    )
    .in("property_id", ownedPropertyIds)
    .eq("approved", true)
    .neq("status", "paid")
    .not("due_date", "is", null);
  if (error) throw new Error(error.message);

  const open = (bills ?? []).filter(
    (b) => Number(b.total_amount) - Number(b.paid_amount) > 0.009,
  );
  result.candidates = open.length;
  if (open.length === 0) return result;

  const openBillIds = open.map((b) => b.id);
  const [settingsRes, tenantsRes, logsRes, roomsRes] = await Promise.all([
    supabase.from("settings").select("admin_id, reminder_days_before, remind_on_due_date"),
    supabase.from("tenants").select("id, full_name, email, room_id, status"),
    supabase
      .from("notification_logs")
      .select("bill_id, sent_at, status, message_type")
      .in("bill_id", openBillIds)
      .eq("message_type", "payment-reminder")
      .eq("status", "sent"),
    supabase.from("rooms").select("id, room_number"),
  ]);

  // A failed supporting query must not degrade into a silent skip: an empty
  // notification_logs result would disable both dedup guards and resend.
  for (const r of [settingsRes, tenantsRes, logsRes, roomsRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const propertyById = new Map((propertiesRes.data ?? []).map((p) => [p.id, p]));
  const settingsByAdmin = new Map((settingsRes.data ?? []).map((s) => [s.admin_id, s]));
  const tenantById = new Map((tenantsRes.data ?? []).map((t) => [t.id, t]));
  const roomById = new Map((roomsRes.data ?? []).map((r) => [r.id, r]));

  // Last successful reminder per bill, used for the same-day and overdue guards.
  const lastReminder = new Map<string, string>();
  for (const log of logsRes.data ?? []) {
    if (!log.bill_id) continue;
    const day = log.sent_at.slice(0, 10);
    const prev = lastReminder.get(log.bill_id);
    if (!prev || day > prev) lastReminder.set(log.bill_id, day);
  }

  const overdueToMark: string[] = [];

  for (const bill of open) {
    const property = propertyById.get(bill.property_id);
    const tenant = tenantById.get(bill.tenant_id);
    if (!property || !tenant) {
      result.skipped += 1;
      continue;
    }
    if (tenant.status === "vacated") {
      result.skipped += 1;
      continue;
    }

    const settings = settingsByAdmin.get(property.admin_id);
    const before = settings?.reminder_days_before ?? 3;
    const remindOnDue = settings?.remind_on_due_date ?? true;
    const dueDate = bill.due_date!;
    const diff = daysBetween(today, dueDate); // > 0 = still upcoming

    let kind: ReminderKind | null = null;
    if (diff === before && before > 0) kind = "before-due";
    else if (diff === 0 && remindOnDue) kind = "on-due";
    else if (diff < 0) kind = "overdue";

    if (diff < 0 && bill.status !== "overdue") overdueToMark.push(bill.id);
    if (!kind) continue;

    const last = lastReminder.get(bill.id);
    if (last === today) {
      result.skipped += 1;
      continue;
    }
    if (kind === "overdue" && last && daysBetween(last, today) < OVERDUE_EVERY_DAYS) {
      result.skipped += 1;
      continue;
    }

    result.matched += 1;
    if (options.dryRun) {
      result.details.push({
        billId: bill.id,
        tenant: tenant.full_name,
        kind,
        email: false,
        reason: "Dry run",
      });
      continue;
    }

    const data: ReminderData = {
      tenantName: tenant.full_name,
      propertyName: property.name,
      roomNumber: roomById.get(tenant.room_id)?.room_number ?? "-",
      monthLabel: monthLabel(bill.bill_month),
      balance: Number(bill.total_amount) - Number(bill.paid_amount),
      dueDate,
      kind,
      daysOverdue: Math.max(0, -diff),
    };

    let email = false;
    const reasons: string[] = [];

    if (!tenant.email) {
      reasons.push("Email: no address on file");
    } else {
      const res = await sendTenantEmail(supabase, {
        tenantId: tenant.id,
        billId: bill.id,
        to: tenant.email,
        subject: buildReminderSubject(data),
        html: buildReminderEmailHtml(data),
        messageType: "payment-reminder",
      });
      email = res.sent;
      if (res.sent) result.emailSent += 1;
      else reasons.push(`Email: ${res.reason ?? "failed"}`);
    }

    if (email) lastReminder.set(bill.id, today);
    result.details.push({
      billId: bill.id,
      tenant: tenant.full_name,
      kind,
      email,
      ...(reasons.length ? { reason: reasons.join(" · ") } : {}),
    });
  }

  if (overdueToMark.length > 0 && !options.dryRun) {
    const { error: updateError } = await supabase
      .from("bills")
      .update({ status: "overdue" })
      .in("id", overdueToMark);
    if (updateError) result.errors.push(updateError.message);
    else result.markedOverdue = overdueToMark.length;
  }

  return result;
}
