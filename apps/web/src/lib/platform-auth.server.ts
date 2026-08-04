import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Admin = SupabaseClient<Database>;

export const LOCKOUT_WINDOW_MINUTES = 15;
export const LOCKOUT_THRESHOLD = 5;

export type PlatformIdentity = {
  isSuperAdmin: boolean;
  isOwner: boolean;
  email: string;
  /** True once the session has passed the second factor. */
  mfaSatisfied: boolean;
  /** True when the account has at least one verified TOTP factor. */
  mfaEnrolled: boolean;
};

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Admin;
}

/** Who this session is, on both sides of the boundary. Never throws on a normal owner. */
export async function loadIdentity(
  userId: string,
  email: string,
  aal: string | undefined,
): Promise<PlatformIdentity> {
  const db = await admin();
  const [sa, ow, factors] = await Promise.all([
    db.from("super_admins").select("id, disabled").eq("id", userId).maybeSingle(),
    db.from("admins").select("id").eq("id", userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);

  const verified = (factors.data?.user?.factors ?? []).some(
    (f) => f.status === "verified" && f.factor_type === "totp",
  );

  return {
    isSuperAdmin: !!sa.data && !sa.data.disabled,
    isOwner: !!ow.data,
    email,
    mfaSatisfied: aal === "aal2",
    mfaEnrolled: verified,
  };
}

/**
 * Gate for every platform-level read or write. Requires a live super_admins row
 * AND a session that already passed the second factor.
 */
export async function assertPlatformAdmin(context: {
  userId: string;
  claims: Record<string, unknown>;
}): Promise<{ db: Admin; email: string }> {
  const email = String(context.claims["email"] ?? "");
  const aal = context.claims["aal"] as string | undefined;
  const db = await admin();

  const { data, error } = await db
    .from("super_admins")
    .select("id, disabled")
    .eq("id", context.userId)
    .maybeSingle();

  if (error) {
    console.error("[platform-auth] lookup failed", error);
    throw new Error("Unable to verify permissions");
  }
  if (!data || data.disabled) throw new Error("Forbidden");
  if (aal !== "aal2") throw new Error("Two-factor authentication required");

  return { db, email };
}

/** Appends an immutable audit entry. Never blocks the caller on failure. */
export async function logAction(
  db: Admin,
  entry: {
    actorId: string;
    actorEmail: string;
    action: string;
    targetAdminId?: string | null;
    targetLabel?: string;
    reason?: string;
    details?: unknown;
  },
) {
  const { error } = await db.from("super_admin_audit_log").insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    action: entry.action,
    target_admin_id: entry.targetAdminId ?? null,
    target_label: entry.targetLabel ?? "",
    reason: entry.reason ?? "",
    details: (entry.details ?? {}) as never,
  });
  if (error) console.error("[platform-auth] audit write failed", error);
}

/** Failed-login throttling for the platform console. */
export async function recordLoginAttempt(email: string, succeeded: boolean) {
  const db = await admin();
  await db.from("super_admin_login_attempts").insert({ email, succeeded });
  return getLockout(email);
}

export async function getLockout(email: string) {
  const db = await admin();
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000).toISOString();
  const { data } = await db
    .from("super_admin_login_attempts")
    .select("succeeded, created_at")
    .ilike("email", email)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  let failures = 0;
  for (const row of data ?? []) {
    if (row.succeeded) break;
    failures += 1;
  }
  return {
    failures,
    locked: failures >= LOCKOUT_THRESHOLD,
    retryAfterMinutes: LOCKOUT_WINDOW_MINUTES,
  };
}
