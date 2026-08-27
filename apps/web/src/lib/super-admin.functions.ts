import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function validQuota(value: unknown, field = "WhatsApp quota") {
  const quota = Number(value);
  if (!Number.isInteger(quota) || quota < 0 || quota > 100_000) {
    throw new Error(`${field} must be a whole number from 0 to 100,000`);
  }
  return quota;
}

/** Platform operational and WhatsApp-quota metrics. */
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

/** Every PG owner with portfolio size and this calendar month's WhatsApp usage. */
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

/** The quota inherited by future owner accounts. Existing owners are deliberately unaffected. */
export const getGlobalWhatsAppQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("@/lib/platform-auth.server");
    const { loadGlobalWhatsAppQuota } = await import("@/lib/super-admin.server");
    const { db } = await assertPlatformAdmin(context as never);
    return { limit: await loadGlobalWhatsAppQuota(db) };
  });

/** Changes the default only for owners created after the update. */
export const setGlobalWhatsAppQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit: number }) => ({ limit: validQuota(input.limit) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadGlobalWhatsAppQuota, setGlobalWhatsAppQuota: set } =
      await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const previousLimit = await loadGlobalWhatsAppQuota(db);
    const result = await set(db, data.limit);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "set_default_whatsapp_quota",
      details: { previousLimit, limit: data.limit, appliesTo: "new owners only" },
    });
    return result;
  });

/** Sets one owner's finite monthly quota or explicit unlimited status. */
export const setOwnerWhatsAppQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string; monthlyLimit: number; unlimited: boolean }) => ({
    adminId: String(input.adminId),
    monthlyLimit: validQuota(input.monthlyLimit),
    unlimited: Boolean(input.unlimited),
  }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { setOwnerWhatsAppQuota: set } = await import("@/lib/super-admin.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const previous = await set(db, data);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "set_owner_whatsapp_quota",
      targetAdminId: data.adminId,
      details: {
        previous,
        monthlyLimit: data.monthlyLimit,
        unlimited: data.unlimited,
      },
    });
    return { ok: true as const };
  });
