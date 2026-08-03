import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Recompute (without saving) what one tenant's bill for a month would be. */
export const previewTenantBillFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; month: string }) => input)
  .handler(async ({ data, context }) => {
    const { isValidMonth } = await import("@/lib/billing-run.server");
    const { previewTenantBill } = await import("@/lib/tenant-billing.server");
    if (!isValidMonth(data.month)) throw new Error("Invalid month.");
    if (!data.tenantId) throw new Error("Pick a tenant.");
    return previewTenantBill(context.supabase, data.tenantId, data.month);
  });

/** Re-run billing for a single tenant + month, leaving every other bill alone. */
export const rerunTenantBillFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; month: string; force?: boolean; notify?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { isValidMonth } = await import("@/lib/billing-run.server");
    const { rerunTenantBill } = await import("@/lib/tenant-billing.server");
    if (!isValidMonth(data.month)) throw new Error("Invalid month.");
    if (!data.tenantId) throw new Error("Pick a tenant.");
    const result = await rerunTenantBill(
      context.supabase,
      data.tenantId,
      data.month,
      data.force === true,
    );

    if (data.notify === false || !result.billId) {
      return { ...result, notified: null };
    }

    // Notifications are best-effort: a failing channel never undoes the re-run.
    const { notifyTenantAboutBill } = await import("@/lib/bill-notify.server");
    const notified = await notifyTenantAboutBill(context.supabase, result.billId, {
      updated: result.action === "updated",
    });
    return { ...result, notified };
  });
