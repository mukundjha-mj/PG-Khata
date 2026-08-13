import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-triggered version of the scheduled daily payment reminder run.
 *
 * Scoped to the calling admin. The underlying job runs with the service role
 * and would otherwise email every owner's tenants and mark their bills overdue.
 */
export const sendPaymentReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { runPaymentReminders } = await import("@/lib/reminders.server");
    return runPaymentReminders({ dryRun: data.dryRun === true, adminId: context.userId });
  });

/**
 * Sends a reminder for specific bills right now, bypassing the due-date and
 * dedup gates that the scheduled run applies.
 */
export const sendManualPaymentReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { billIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    if (data.billIds.length === 0) throw new Error("Nothing selected to remind.");
    const { sendManualReminders } = await import("@/lib/reminders.server");
    return sendManualReminders(data.billIds, context.userId);
  });

/**
 * Owner-authored reminder for one or more tenants: `mode: "now"` sends
 * immediately to every tenant picked; `mode: "schedule"` files a pending row
 * per tenant for the nightly sweep to send on `remindOn`. Runs on the
 * caller's own RLS-scoped client, so ownership of the tenant/bill is
 * enforced by the database, not by this handler.
 */
export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantIds: string[];
      billId: string | null;
      mode: "now" | "schedule";
      remindOn: string;
      channels: { email: boolean; whatsapp: boolean };
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { scheduleReminder } = await import("@/lib/reminders.server");
    return scheduleReminder(context.supabase, {
      tenantIds: data.tenantIds,
      billId: data.billId,
      mode: data.mode,
      remindOn: data.remindOn,
      channels: data.channels,
      adminId: context.userId,
    });
  });

/**
 * Personal payment follow-up reminder: tied to a tenant so it's clear who
 * it's about, but never messages them - it surfaces on the owner's
 * dashboard on remindOn until dismissed.
 */
export const createPersonalReminderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; remindOn: string; note: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { createPersonalReminder } = await import("@/lib/reminders.server");
    return createPersonalReminder(context.supabase, {
      adminId: context.userId,
      tenantId: data.tenantId,
      remindOn: data.remindOn,
      note: data.note,
    });
  });

/** Pending reminders the calling owner has scheduled but not yet sent. */
export const getScheduledReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listScheduledReminders } = await import("@/lib/reminders.server");
    return listScheduledReminders(context.supabase);
  });

/** Cancels a pending reminder before it fires. */
export const cancelReminderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { cancelScheduledReminder } = await import("@/lib/reminders.server");
    await cancelScheduledReminder(context.supabase, data.id);
    return { ok: true };
  });
