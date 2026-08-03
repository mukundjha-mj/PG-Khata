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
