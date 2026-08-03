import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Platform-wide research numbers. Platform team only. */
export const getPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadPlatformStats } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_platform_stats",
    });
    return loadPlatformStats(db);
  });

/** Every owner account with plan and portfolio size. Platform team only. */
export const listAllAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadAccounts } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_directory",
    });
    return loadAccounts(db);
  });

/** Sets an account's plan directly, with no charge. Platform team only. */
export const setAccountPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { adminId: string; plan: "starter" | "growing" | "scale"; reason: string }) => {
      const reason = String(input.reason ?? "").trim();
      if (reason.length < 4) throw new Error("A reason is required for manual overrides");
      return { adminId: input.adminId, plan: input.plan, reason: reason.slice(0, 500) };
    },
  )
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { overridePlan } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const result = await overridePlan(db, data.adminId, data.plan);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "override_plan",
      targetAdminId: data.adminId,
      reason: data.reason,
      details: { plan: data.plan },
    });
    return result;
  });
