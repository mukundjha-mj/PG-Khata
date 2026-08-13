import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The calling owner's signup link for a property, created on first call. */
export const getSignupLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { getOrCreateSignupLink } = await import("@/lib/signup-links.server");
    return getOrCreateSignupLink(context.supabase, data.propertyId);
  });

/** Issues a new token, invalidating whatever link was shared before. */
export const regenerateSignupLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { regenerateSignupLink } = await import("@/lib/signup-links.server");
    return regenerateSignupLink(context.supabase, data.propertyId);
  });

export const setSignupLinkActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { setSignupLinkActive } = await import("@/lib/signup-links.server");
    return setSignupLinkActive(context.supabase, data.propertyId, data.isActive);
  });
