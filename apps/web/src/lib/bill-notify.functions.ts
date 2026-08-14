import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BillNotifyResult } from "@/lib/bill-notify.server";

export type NotifyBillResult = { billId: string; tenantName: string } & BillNotifyResult;

/**
 * Resends the bill-ready notification (email + WhatsApp) for one or more
 * already-issued bills, on demand.
 *
 * Selects go through the caller's RLS-scoped client, so a billId belonging to
 * another admin simply returns no row and is silently dropped from the batch
 * rather than notified. notifyTenantAboutBill re-fetches each bill with the
 * same client, so ownership is enforced twice over.
 */
export const notifyBillsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { billIds: string[]; channels?: { email: boolean; whatsapp: boolean } }) => input,
  )
  .handler(async ({ data, context }): Promise<{ results: NotifyBillResult[] }> => {
    if (data.billIds.length === 0) throw new Error("Nothing selected to notify.");

    const { data: bills, error } = await context.supabase
      .from("bills")
      .select("id, tenant_id")
      .in("id", data.billIds);
    if (error) throw new Error(error.message);
    if (!bills || bills.length === 0) throw new Error("No matching bills found.");

    const { data: tenants, error: tenantsError } = await context.supabase
      .from("tenants")
      .select("id, full_name")
      .in(
        "id",
        bills.map((b) => b.tenant_id),
      );
    if (tenantsError) throw new Error(tenantsError.message);
    const nameById = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));

    // Best-effort per bill: a failing tenant must not stop the rest of the batch.
    const { notifyTenantAboutBill } = await import("@/lib/bill-notify.server");
    const results: NotifyBillResult[] = [];
    for (const bill of bills) {
      const res = await notifyTenantAboutBill(context.supabase, bill.id, {
        updated: false,
        channels: data.channels,
      });
      results.push({
        billId: bill.id,
        tenantName: nameById.get(bill.tenant_id) ?? "Tenant",
        ...res,
      });
    }
    return { results };
  });
