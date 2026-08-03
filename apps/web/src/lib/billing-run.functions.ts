import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-triggered version of the scheduled monthly billing run.
 *
 * Scoped to the calling admin. The underlying job runs with the service role
 * and would otherwise bill every owner on the platform.
 */
export const generateMonthlyBills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month: string }) => input)
  .handler(async ({ data, context }) => {
    const { runMonthlyBilling, isValidMonth } = await import("@/lib/billing-run.server");
    if (!isValidMonth(data.month)) throw new Error("Invalid month.");
    return runMonthlyBilling(data.month, { adminId: context.userId });
  });
