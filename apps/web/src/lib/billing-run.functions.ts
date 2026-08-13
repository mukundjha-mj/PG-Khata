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

export type DraftBillRow = {
  tenant_id: string;
  property_id: string;
  bill_month: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  rent_amount: number;
  electricity_amount: number;
  electricity_units_consumed: number | null;
  other_charges: { label: string; amount: number }[];
  total_amount: number;
  due_date: string;
  status: "pending";
};

/**
 * Saves the reviewed drafts from the "Generate bills" dialog and notifies
 * each new tenant on their configured channels.
 *
 * Insert goes through the caller's RLS-scoped client, so a draft naming
 * another admin's tenant or property fails at the database rather than here.
 */
export const saveBillDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: DraftBillRow[] }) => input)
  .handler(async ({ data, context }) => {
    if (data.rows.length === 0) throw new Error("Nothing selected to bill.");
    const { data: inserted, error } = await context.supabase
      .from("bills")
      .insert(data.rows)
      .select("id");
    if (error) throw new Error(error.message);

    // Best-effort: a tenant who can't be notified must not undo bills already
    // saved for everyone else in the same batch.
    const { notifyTenantAboutBill } = await import("@/lib/bill-notify.server");
    for (const bill of inserted ?? []) {
      await notifyTenantAboutBill(context.supabase, bill.id, { updated: false });
    }

    return { created: inserted?.length ?? 0 };
  });
