import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The calling owner's complaint link for a property, created on first call. */
export const getComplaintLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { getOrCreateComplaintLink } = await import("@/lib/complaint-links.server");
    return getOrCreateComplaintLink(context.supabase, data.propertyId);
  });

/** Issues a new token, invalidating whatever link was shared before. */
export const regenerateComplaintLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => input)
  .handler(async ({ data, context }) => {
    const { regenerateComplaintLink } = await import("@/lib/complaint-links.server");
    return regenerateComplaintLink(context.supabase, data.propertyId);
  });

export const setComplaintLinkActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { setComplaintLinkActive } = await import("@/lib/complaint-links.server");
    return setComplaintLinkActive(context.supabase, data.propertyId, data.isActive);
  });
