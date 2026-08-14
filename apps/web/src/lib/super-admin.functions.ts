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

/** Every coupon on the platform. Platform team only. */
export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { listCoupons: load } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_coupons",
    });
    return load(db);
  });

/** Creates a new trial coupon. Platform team only. */
export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { trialDays?: number; maxRedemptions?: number | null; expiresAt?: string | null }) => {
      const trialDays = Math.max(1, Math.min(90, Math.round(Number(input.trialDays ?? 14))));
      const maxRedemptions =
        input.maxRedemptions == null ? null : Math.max(1, Math.round(Number(input.maxRedemptions)));
      return { trialDays, maxRedemptions, expiresAt: input.expiresAt ?? null };
    },
  )
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { createCoupon: create } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const coupon = await create(db, context.userId, {
      trialDays: data.trialDays,
      maxRedemptions: data.maxRedemptions,
      expiresAt: data.expiresAt,
    });
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "create_coupon",
      details: { code: coupon.code, trialDays: coupon.trial_days },
    });
    return coupon;
  });

/** Deactivates a coupon. Platform team only. */
export const deactivateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { couponId: string }) => ({ couponId: String(input.couponId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { deactivateCoupon: deactivate } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const result = await deactivate(db, data.couponId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "deactivate_coupon",
      details: { couponId: data.couponId },
    });
    return result;
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
