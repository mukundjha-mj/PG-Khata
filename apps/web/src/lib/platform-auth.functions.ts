import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Identity of the current session on both sides of the owner / platform boundary. */
export const getPlatformIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadIdentity } = await import("@/lib/platform-auth.server");
    const claims = context.claims as Record<string, unknown>;
    return loadIdentity(
      context.userId,
      String(claims["email"] ?? ""),
      claims["aal"] as string | undefined,
    );
  });

/** Records a platform console sign-in attempt and returns the lockout state. */
export const notePlatformLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; succeeded: boolean }) => ({
    email: String(input.email ?? "").slice(0, 200),
    succeeded: !!input.succeeded,
  }))
  .handler(async ({ data }) => {
    const { recordLoginAttempt } = await import("@/lib/platform-auth.server");
    return recordLoginAttempt(data.email, data.succeeded);
  });

/** Current lockout state for an email, without recording an attempt. */
export const getPlatformLockout = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({
    email: String(input.email ?? "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const { getLockout } = await import("@/lib/platform-auth.server");
    return getLockout(data.email);
  });

/** Audit trail, newest first. Platform team only. */
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("@/lib/platform-auth.server");
    const { db } = await assertPlatformAdmin(context as never);
    const { data, error } = await db
      .from("super_admin_audit_log")
      .select("id, actor_email, action, target_admin_id, target_label, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Unable to load audit log");
    return data ?? [];
  });
