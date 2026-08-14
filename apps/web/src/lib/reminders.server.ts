import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildReminderEmailHtml,
  buildReminderMessage,
  buildReminderSubject,
  buildReminderTemplate,
  type ReminderData,
  type ReminderKind,
} from "@/lib/reminder-message";
import { sendTenantEmail } from "@/lib/email.server";
import { buildBillNote, tryBuildUpiIntent } from "@/lib/upi";
import { isWhatsAppConfigured, sendTenantWhatsApp } from "@/lib/whatsapp.server";
import { checkWhatsAppQuota } from "@/lib/whatsapp-quota.server";
import { tierByKey } from "@/lib/pricing-plans";

/** Minimum gap between two overdue reminders for the same bill. */
const OVERDUE_EVERY_DAYS = 3;

export type ReminderRunResult = {
  today: string;
  candidates: number;
  matched: number;
  emailSent: number;
  whatsappSent: number;
  skipped: number;
  markedOverdue: number;
  errors: string[];
  details: Array<{
    billId: string;
    tenant: string;
    kind: ReminderKind;
    email: boolean;
    whatsapp: boolean;
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
    whatsappSent: 0,
    skipped: 0,
    markedOverdue: 0,
    errors: [],
    details: [],
  };

  // Scope first: everything downstream is filtered to these properties.
  const propertyQuery = supabase.from("properties").select("id, admin_id, name");
  const propertiesRes = await (adminId ? propertyQuery.eq("admin_id", adminId) : propertyQuery);
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

  const open = (bills ?? []).filter((b) => Number(b.total_amount) - Number(b.paid_amount) > 0.009);
  result.candidates = open.length;
  if (open.length === 0) return result;

  const openBillIds = open.map((b) => b.id);
  const [settingsRes, tenantsRes, logsRes, roomsRes] = await Promise.all([
    supabase
      .from("settings")
      .select(
        "admin_id, reminder_days_before, remind_on_due_date, upi_vpa, upi_payee_name, brand_name, whatsapp_enabled, whatsapp_country_code, plan, plan_updated_at",
      ),
    supabase.from("tenants").select("id, full_name, email, phone, room_id, status"),
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
        whatsapp: false,
        reason: "Dry run",
      });
      continue;
    }

    const roomNumber = roomById.get(tenant.room_id)?.room_number ?? "-";
    const balance = Number(bill.total_amount) - Number(bill.paid_amount);

    const data: ReminderData = {
      tenantName: tenant.full_name,
      propertyName: property.name,
      roomNumber,
      monthLabel: monthLabel(bill.bill_month),
      balance,
      dueDate,
      kind,
      daysOverdue: Math.max(0, -diff),
      // Money moves tenant -> owner directly. A bad VPA or an out-of-range
      // balance must not abort the whole run: the reminder is still worth
      // sending without a pay link.
      ...(() => {
        const intent = settings?.upi_vpa
          ? tryBuildUpiIntent({
              vpa: settings.upi_vpa,
              payeeName: settings.upi_payee_name || settings.brand_name || property.name,
              amount: balance,
              note: buildBillNote(monthLabel(bill.bill_month), roomNumber),
            })
          : null;
        return intent ? { upiIntent: intent } : {};
      })(),
    };

    let email = false;
    let whatsapp = false;
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

    if (settings?.whatsapp_enabled && isWhatsAppConfigured()) {
      if (!tenant.phone) {
        reasons.push("WhatsApp: no phone number on file");
      } else {
        const quota = await checkWhatsAppQuota(
          supabase,
          property.admin_id,
          tierByKey(settings.plan ?? "starter"),
          settings.plan_updated_at,
        );
        if (!quota.allowed) {
          reasons.push(quota.reason);
        } else {
          const res = await sendTenantWhatsApp(supabase, {
            tenantId: tenant.id,
            adminId: property.admin_id,
            billId: bill.id,
            phone: tenant.phone,
            dialCode: settings.whatsapp_country_code ?? "91",
            template: buildReminderTemplate(data),
            messageType: "payment-reminder",
          });
          whatsapp = res.sent;
          if (res.sent) result.whatsappSent += 1;
          else reasons.push(`WhatsApp: ${res.reason ?? "failed"}`);
        }
      }
    }

    // Any successful channel closes the day for this bill, so a tenant who has
    // both email and WhatsApp is not chased twice on the same day.
    if (email || whatsapp) lastReminder.set(bill.id, today);
    result.details.push({
      billId: bill.id,
      tenant: tenant.full_name,
      kind,
      email,
      whatsapp,
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

export type ManualReminderResult = {
  matched: number;
  emailSent: number;
  whatsappSent: number;
  details: Array<{
    billId: string;
    tenant: string;
    kind: ReminderKind;
    email: boolean;
    whatsapp: boolean;
    reason?: string;
  }>;
};

/**
 * Sends a reminder for specific bills right now, regardless of due date.
 *
 * Unlike runPaymentReminders, this never skips: no due-date gate, no same-day
 * dedup, no overdue cooldown, no overdue status side effect. Wording (kind)
 * still adapts to the bill's real due date - it only affects the message, not
 * whether one is sent. `adminId` is required since this is only ever
 * owner-triggered from the UI, never a platform-wide scheduled call.
 */
export async function sendManualReminders(
  billIds: string[],
  adminId: string,
): Promise<ManualReminderResult> {
  const supabase = serviceClient();
  const today = todayIso();
  const result: ManualReminderResult = { matched: 0, emailSent: 0, whatsappSent: 0, details: [] };
  if (billIds.length === 0) return result;

  const propertiesRes = await supabase
    .from("properties")
    .select("id, admin_id, name")
    .eq("admin_id", adminId);
  if (propertiesRes.error) throw new Error(propertiesRes.error.message);
  const propertyById = new Map((propertiesRes.data ?? []).map((p) => [p.id, p]));
  if (propertyById.size === 0) return result;

  const { data: bills, error } = await supabase
    .from("bills")
    .select("id, tenant_id, property_id, bill_month, total_amount, paid_amount, due_date")
    .in("id", billIds);
  if (error) throw new Error(error.message);

  // Cross-admin ids are dropped here, not just filtered client-side: an owner
  // must never be able to trigger a send for a bill they do not own.
  const owned = (bills ?? []).filter((b) => propertyById.has(b.property_id));
  if (owned.length === 0) return result;

  const [settingsRes, tenantsRes, roomsRes] = await Promise.all([
    supabase
      .from("settings")
      .select(
        "upi_vpa, upi_payee_name, brand_name, whatsapp_enabled, whatsapp_country_code, plan, plan_updated_at",
      )
      .eq("admin_id", adminId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, full_name, email, phone, room_id")
      .in(
        "id",
        owned.map((b) => b.tenant_id),
      ),
    supabase.from("rooms").select("id, room_number"),
  ]);
  for (const r of [settingsRes, tenantsRes, roomsRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const tenantById = new Map((tenantsRes.data ?? []).map((t) => [t.id, t]));
  const roomById = new Map((roomsRes.data ?? []).map((r) => [r.id, r]));
  const settings = settingsRes.data;

  for (const bill of owned) {
    const property = propertyById.get(bill.property_id);
    const tenant = tenantById.get(bill.tenant_id);
    if (!property || !tenant) continue;

    const balance = Number(bill.total_amount) - Number(bill.paid_amount);
    if (balance <= 0.009) {
      result.details.push({
        billId: bill.id,
        tenant: tenant.full_name,
        kind: "on-due",
        email: false,
        whatsapp: false,
        reason: "Bill has no balance due",
      });
      continue;
    }

    const dueDate = bill.due_date;
    const diff = dueDate ? daysBetween(today, dueDate) : 0;
    const kind: ReminderKind = !dueDate
      ? "on-due"
      : diff > 0
        ? "before-due"
        : diff === 0
          ? "on-due"
          : "overdue";

    const roomNumber = roomById.get(tenant.room_id)?.room_number ?? "-";
    const data: ReminderData = {
      tenantName: tenant.full_name,
      propertyName: property.name,
      roomNumber,
      monthLabel: monthLabel(bill.bill_month),
      balance,
      dueDate,
      kind,
      daysOverdue: Math.max(0, -diff),
      ...(() => {
        const intent = settings?.upi_vpa
          ? tryBuildUpiIntent({
              vpa: settings.upi_vpa,
              payeeName: settings.upi_payee_name || settings.brand_name || property.name,
              amount: balance,
              note: buildBillNote(monthLabel(bill.bill_month), roomNumber),
            })
          : null;
        return intent ? { upiIntent: intent } : {};
      })(),
    };

    result.matched += 1;
    let email = false;
    let whatsapp = false;
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

    if (settings?.whatsapp_enabled && isWhatsAppConfigured()) {
      if (!tenant.phone) {
        reasons.push("WhatsApp: no phone number on file");
      } else {
        const quota = await checkWhatsAppQuota(
          supabase,
          adminId,
          tierByKey(settings.plan ?? "starter"),
          settings.plan_updated_at,
        );
        if (!quota.allowed) {
          reasons.push(quota.reason);
        } else {
          const res = await sendTenantWhatsApp(supabase, {
            tenantId: tenant.id,
            adminId,
            billId: bill.id,
            phone: tenant.phone,
            dialCode: settings.whatsapp_country_code ?? "91",
            template: buildReminderTemplate(data),
            messageType: "payment-reminder",
          });
          whatsapp = res.sent;
          if (res.sent) result.whatsappSent += 1;
          else reasons.push(`WhatsApp: ${res.reason ?? "failed"}`);
        }
      }
    }

    result.details.push({
      billId: bill.id,
      tenant: tenant.full_name,
      kind,
      email,
      whatsapp,
      ...(reasons.length ? { reason: reasons.join(" · ") } : {}),
    });
  }

  return result;
}

export type ScheduledReminderChannels = { email: boolean; whatsapp: boolean };

export type ScheduledReminder = {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  note: string | null;
  billId: string | null;
  remindOn: string;
  channelEmail: boolean;
  channelWhatsapp: boolean;
  status: string;
  createdAt: string;
};

/**
 * Sends one tenant's reminder over the channel(s) the owner picked, on
 * whatever wording their current bill balance supports. Shared by the
 * instant path (scheduleReminder, when remindOn is today) and the due-date
 * sweep (processDueScheduledReminders).
 */
async function sendOneReminder(
  supabase: SupabaseClient<Database>,
  args: {
    tenantId: string;
    billId: string | null;
    adminId: string;
    channels: ScheduledReminderChannels;
  },
): Promise<{ email: boolean; whatsapp: boolean; reason?: string }> {
  const today = todayIso();

  const [tenantRes, settingsRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, full_name, email, phone, room_id")
      .eq("id", args.tenantId)
      .maybeSingle(),
    supabase
      .from("settings")
      .select(
        "upi_vpa, upi_payee_name, brand_name, whatsapp_enabled, whatsapp_country_code, plan, plan_updated_at",
      )
      .eq("admin_id", args.adminId)
      .maybeSingle(),
  ]);
  if (tenantRes.error) throw new Error(tenantRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  const tenant = tenantRes.data;
  if (!tenant) return { email: false, whatsapp: false, reason: "Tenant not found" };
  const settings = settingsRes.data;

  let bill: {
    id: string;
    property_id: string;
    bill_month: string;
    total_amount: number;
    paid_amount: number;
    due_date: string | null;
  } | null = null;
  if (args.billId) {
    const billRes = await supabase
      .from("bills")
      .select("id, property_id, bill_month, total_amount, paid_amount, due_date")
      .eq("id", args.billId)
      .maybeSingle();
    if (billRes.error) throw new Error(billRes.error.message);
    bill = billRes.data;
  }

  const roomRes = await supabase
    .from("rooms")
    .select("room_number")
    .eq("id", tenant.room_id)
    .maybeSingle();
  const roomNumber = roomRes.data?.room_number ?? "-";

  let propertyName = "Your PG";
  if (bill) {
    const propertyRes = await supabase
      .from("properties")
      .select("name")
      .eq("id", bill.property_id)
      .maybeSingle();
    propertyName = propertyRes.data?.name ?? propertyName;
  }

  const balance = bill ? Number(bill.total_amount) - Number(bill.paid_amount) : 0;
  const dueDate = bill?.due_date ?? null;
  const diff = dueDate ? daysBetween(today, dueDate) : 0;
  const kind: ReminderKind = !dueDate
    ? "on-due"
    : diff > 0
      ? "before-due"
      : diff === 0
        ? "on-due"
        : "overdue";
  const billMonthLabel = bill ? monthLabel(bill.bill_month) : "";

  const data: ReminderData = {
    tenantName: tenant.full_name,
    propertyName,
    roomNumber,
    monthLabel: billMonthLabel,
    balance,
    dueDate,
    kind,
    daysOverdue: Math.max(0, -diff),
    ...(() => {
      const intent = settings?.upi_vpa
        ? tryBuildUpiIntent({
            vpa: settings.upi_vpa,
            payeeName: settings.upi_payee_name || settings.brand_name || propertyName,
            amount: balance,
            note: buildBillNote(billMonthLabel, roomNumber),
          })
        : null;
      return intent ? { upiIntent: intent } : {};
    })(),
  };

  let email = false;
  let whatsapp = false;
  const reasons: string[] = [];

  if (args.channels.email) {
    if (!tenant.email) {
      reasons.push("Email: no address on file");
    } else {
      const res = await sendTenantEmail(supabase, {
        tenantId: tenant.id,
        billId: args.billId,
        to: tenant.email,
        subject: buildReminderSubject(data),
        html: buildReminderEmailHtml(data),
        messageType: "payment-reminder",
      });
      email = res.sent;
      if (!res.sent) reasons.push(`Email: ${res.reason ?? "failed"}`);
    }
  }

  if (args.channels.whatsapp) {
    if (!settings?.whatsapp_enabled || !isWhatsAppConfigured()) {
      reasons.push("WhatsApp: not enabled");
    } else if (!tenant.phone) {
      reasons.push("WhatsApp: no phone number on file");
    } else {
      const quota = await checkWhatsAppQuota(
        supabase,
        args.adminId,
        tierByKey(settings.plan ?? "starter"),
        settings.plan_updated_at,
      );
      if (!quota.allowed) {
        reasons.push(quota.reason);
      } else {
        const res = await sendTenantWhatsApp(supabase, {
          tenantId: tenant.id,
          adminId: args.adminId,
          billId: args.billId,
          phone: tenant.phone,
          dialCode: settings.whatsapp_country_code ?? "91",
          template: buildReminderTemplate(data),
          messageType: "payment-reminder",
        });
        whatsapp = res.sent;
        if (!res.sent) reasons.push(`WhatsApp: ${res.reason ?? "failed"}`);
      }
    }
  }

  return { email, whatsapp, ...(reasons.length ? { reason: reasons.join(" · ") } : {}) };
}

export type ScheduleReminderResult = {
  tenantId: string;
  sentNow: boolean;
  email: boolean;
  whatsapp: boolean;
  reason?: string;
};

/**
 * Creates an owner-authored reminder for one or more tenants. `mode: "now"`
 * sends immediately to every tenant and records each as already-`sent`;
 * `mode: "schedule"` files one pending row per tenant for the nightly sweep
 * to pick up on `remindOn`. Ownership of tenant/bill is verified via RLS on
 * the caller's own (non-service-role) client - unlike the automated engine
 * above, this always runs as the calling owner.
 */
export async function scheduleReminder(
  supabase: SupabaseClient<Database>,
  args: {
    tenantIds: string[];
    billId: string | null;
    mode: "now" | "schedule";
    remindOn: string;
    channels: ScheduledReminderChannels;
    adminId: string;
  },
): Promise<ScheduleReminderResult[]> {
  if (!args.channels.email && !args.channels.whatsapp) {
    throw new Error("Pick at least one channel: email, WhatsApp, or both.");
  }
  if (args.tenantIds.length === 0) {
    throw new Error("Pick at least one tenant.");
  }

  if (args.mode === "now") {
    const results: ScheduleReminderResult[] = [];
    for (const tenantId of args.tenantIds) {
      const res = await sendOneReminder(supabase, {
        tenantId,
        billId: args.billId,
        adminId: args.adminId,
        channels: args.channels,
      });
      const { error } = await supabase.from("scheduled_reminders").insert({
        admin_id: args.adminId,
        tenant_id: tenantId,
        bill_id: args.billId,
        remind_on: todayIso(),
        channel_email: args.channels.email,
        channel_whatsapp: args.channels.whatsapp,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      results.push({ tenantId, sentNow: true, ...res });
    }
    return results;
  }

  const rows = args.tenantIds.map((tenantId) => ({
    admin_id: args.adminId,
    tenant_id: tenantId,
    bill_id: args.billId,
    remind_on: args.remindOn,
    channel_email: args.channels.email,
    channel_whatsapp: args.channels.whatsapp,
    status: "pending",
  }));
  const { error } = await supabase.from("scheduled_reminders").insert(rows);
  if (error) throw new Error(error.message);
  return args.tenantIds.map((tenantId) => ({
    tenantId,
    sentNow: false,
    email: false,
    whatsapp: false,
  }));
}

/**
 * Creates a personal payment-follow-up reminder: tied to a tenant so it's
 * clear who it's about, but never messages them - no channel is ever set on
 * this row. Surfaces on the owner's dashboard on remindOn until dismissed.
 * Reuses the same table and pending/cancel lifecycle as tenant reminders.
 */
export async function createPersonalReminder(
  supabase: SupabaseClient<Database>,
  args: { adminId: string; tenantId: string; remindOn: string; note: string | null },
): Promise<void> {
  const { error } = await supabase.from("scheduled_reminders").insert({
    admin_id: args.adminId,
    tenant_id: args.tenantId,
    bill_id: null,
    remind_on: args.remindOn,
    channel_email: false,
    channel_whatsapp: false,
    note: args.note?.trim() || null,
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

/** Pending (not yet sent, not cancelled) reminders for the calling owner. */
export async function listScheduledReminders(
  supabase: SupabaseClient<Database>,
): Promise<ScheduledReminder[]> {
  const { data, error } = await supabase
    .from("scheduled_reminders")
    .select(
      "id, tenant_id, bill_id, remind_on, channel_email, channel_whatsapp, status, created_at, note",
    )
    .eq("status", "pending")
    .order("remind_on");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const tenantIds = rows.map((r) => r.tenant_id).filter((id): id is string => id !== null);
  const nameById = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, full_name")
      .in("id", tenantIds);
    if (tenantsError) throw new Error(tenantsError.message);
    for (const t of tenants ?? []) nameById.set(t.id, t.full_name);
  }

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: r.tenant_id ? (nameById.get(r.tenant_id) ?? "Tenant") : null,
    note: r.note,
    billId: r.bill_id,
    remindOn: r.remind_on,
    channelEmail: r.channel_email,
    channelWhatsapp: r.channel_whatsapp,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** Cancels a pending reminder. RLS scopes this to the calling owner's own rows. */
export async function cancelScheduledReminder(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

export type ScheduledReminderSweepResult = {
  today: string;
  matched: number;
  emailSent: number;
  whatsappSent: number;
  errors: string[];
};

/**
 * Sends every scheduled_reminders row whose date has arrived. Runs with the
 * service role from the nightly cron hook, platform-wide - each row already
 * carries its own admin_id, tenant_id and channel choice, so no per-owner
 * scoping is needed here.
 */
export async function processDueScheduledReminders(
  today?: string,
): Promise<ScheduledReminderSweepResult> {
  const supabase = serviceClient();
  const day = today ?? todayIso();
  const result: ScheduledReminderSweepResult = {
    today: day,
    matched: 0,
    emailSent: 0,
    whatsappSent: 0,
    errors: [],
  };

  // Personal reminders carry a tenant (so the dashboard can label them) but
  // no channel - there's nothing to send, so they stay pending until the
  // owner dismisses them. Only rows with a channel picked are sent here.
  const { data: due, error } = await supabase
    .from("scheduled_reminders")
    .select("id, admin_id, tenant_id, bill_id, channel_email, channel_whatsapp")
    .eq("status", "pending")
    .or("channel_email.eq.true,channel_whatsapp.eq.true")
    .lte("remind_on", day);
  if (error) throw new Error(error.message);
  if (!due || due.length === 0) return result;

  result.matched = due.length;
  for (const row of due) {
    if (!row.tenant_id) continue;
    try {
      const res = await sendOneReminder(supabase, {
        tenantId: row.tenant_id,
        billId: row.bill_id,
        adminId: row.admin_id,
        channels: { email: row.channel_email, whatsapp: row.channel_whatsapp },
      });
      if (res.email) result.emailSent += 1;
      if (res.whatsapp) result.whatsappSent += 1;
      const { error: updateError } = await supabase
        .from("scheduled_reminders")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updateError) result.errors.push(updateError.message);
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : "Reminder send failed");
    }
  }

  return result;
}
