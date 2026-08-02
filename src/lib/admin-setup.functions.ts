import { createServerFn } from "@tanstack/react-start";

/**
 * Public check used by the sign-in page to decide between "sign in" and
 * "first admin setup". Runs server-side with privileged access so the
 * `admins` table itself stays fully locked down to anonymous callers.
 */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("admins")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("[adminExists] failed", error);
    throw new Error("Unable to check setup status");
  }
  return { exists: (count ?? 0) > 0 };
});
