import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Per-owner quick facts: last login, subscription state, recent billing runs. */
export const getOwnerQuickFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadQuickFacts } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const facts = await loadQuickFacts(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_quick_facts",
      targetAdminId: data.adminId,
      targetLabel: facts.email,
      details: { plan: facts.plan, planStatus: facts.planStatus },
    });
    return facts;
  });

/** Full owner record: portfolio, subscription history, usage, support note. */
export const getOwnerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadOwnerDetail } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const detail = await loadOwnerDetail(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_detail",
      targetAdminId: data.adminId,
      targetLabel: detail.account.email,
    });
    return detail;
  });

/** Every tenant across an owner's properties. Read-only support view, platform team only. */
export const getOwnerTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadOwnerTenants } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const rows = await loadOwnerTenants(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_workspace",
      targetAdminId: data.adminId,
      details: { section: "tenants" },
    });
    return rows;
  });

/** Every room across an owner's properties. Read-only support view, platform team only. */
export const getOwnerRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadOwnerRooms } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const rows = await loadOwnerRooms(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_workspace",
      targetAdminId: data.adminId,
      details: { section: "rooms" },
    });
    return rows;
  });

/** Newest 300 bills across an owner's properties. Read-only support view, platform team only. */
export const getOwnerBills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadOwnerBills } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const rows = await loadOwnerBills(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_workspace",
      targetAdminId: data.adminId,
      details: { section: "bills" },
    });
    return rows;
  });

/** Newest 300 payments across an owner's properties. Read-only support view, platform team only. */
export const getOwnerPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadOwnerPaymentsList } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const rows = await loadOwnerPaymentsList(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_workspace",
      targetAdminId: data.adminId,
      details: { section: "payments" },
    });
    return rows;
  });

/** Newest 300 complaints for an owner. Read-only support view, platform team only. */
export const getOwnerComplaints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string }) => ({ adminId: String(input.adminId) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { loadOwnerComplaints } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const rows = await loadOwnerComplaints(db, data.adminId);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "view_owner_workspace",
      targetAdminId: data.adminId,
      details: { section: "complaints" },
    });
    return rows;
  });

/** Saves the platform team's private support note for an owner. */
export const saveOwnerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { adminId: string; note: string }) => ({
    adminId: String(input.adminId),
    note: String(input.note ?? "").slice(0, 5000),
  }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { saveSupportNote } = await import("@/lib/owner-detail.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const result = await saveSupportNote(db, data.adminId, data.note, context.userId, email);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "edit_support_note",
      targetAdminId: data.adminId,
      details: { length: data.note.length },
    });
    return result;
  });
