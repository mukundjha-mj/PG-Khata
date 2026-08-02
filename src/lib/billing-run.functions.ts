import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-triggered version of the scheduled monthly billing run. */
export const generateMonthlyBills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month: string }) => input)
  .handler(async ({ data }) => {
    const { runMonthlyBilling, isValidMonth } = await import("@/lib/billing-run.server");
    if (!isValidMonth(data.month)) throw new Error("Invalid month.");
    return runMonthlyBilling(data.month);
  });
