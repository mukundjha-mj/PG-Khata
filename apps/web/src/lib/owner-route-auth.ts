import type { User } from "@supabase/supabase-js";

const OWNER_ACCESS_TTL_MS = 60_000;

export type OwnerRouteAccess =
  | { kind: "owner"; user: User }
  | { kind: "unauthenticated" }
  | { kind: "platform-admin" };

type CachedOwnerAccess = {
  access: Extract<OwnerRouteAccess, { kind: "owner" }>;
  expiresAt: number;
};

let cachedOwnerAccess: CachedOwnerAccess | undefined;
let ownerAccessRequest: Promise<OwnerRouteAccess> | undefined;
let accessGeneration = 0;

export function getOwnerRouteAccess(): OwnerRouteAccess | Promise<OwnerRouteAccess> {
  if (cachedOwnerAccess && cachedOwnerAccess.expiresAt > Date.now()) {
    return cachedOwnerAccess.access;
  }

  if (!ownerAccessRequest) {
    const generation = accessGeneration;
    ownerAccessRequest = verifyOwnerRouteAccess()
      .then((access) => {
        if (generation === accessGeneration && access.kind === "owner") {
          cachedOwnerAccess = {
            access,
            expiresAt: Date.now() + OWNER_ACCESS_TTL_MS,
          };
        }
        return access;
      })
      .finally(() => {
        if (generation === accessGeneration) ownerAccessRequest = undefined;
      });
  }

  return ownerAccessRequest;
}

export function invalidateOwnerRouteAccess() {
  accessGeneration += 1;
  cachedOwnerAccess = undefined;
  ownerAccessRequest = undefined;
}

async function verifyOwnerRouteAccess(): Promise<OwnerRouteAccess> {
  // Keep the Supabase client out of the marketing entry bundle. This module is
  // imported by the root route too, so a static import would affect every page.
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: "unauthenticated" };

  const { data: platformAdmin } = await supabase
    .from("super_admins")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (platformAdmin) return { kind: "platform-admin" };
  return { kind: "owner", user: data.user };
}
