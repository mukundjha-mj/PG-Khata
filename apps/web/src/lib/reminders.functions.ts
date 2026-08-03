import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-triggered version of the scheduled daily payment reminder run. */
export const sendPaymentReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean }) => input)
  .handler(async ({ data }) => {
    const { runPaymentReminders } = await import("@/lib/reminders.server");
    return runPaymentReminders({ dryRun: data.dryRun === true });
  });
