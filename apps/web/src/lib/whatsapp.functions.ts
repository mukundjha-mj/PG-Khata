import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getWhatsAppQuotaStatus, type QuotaStatus } from "@/lib/whatsapp-quota.server";

/** Returns the signed-in owner's live WhatsApp usage for the current calendar month. */
export const getMyWhatsAppQuotaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuotaStatus> => {
    // The caller is authenticated by the middleware, and the query below is
    // explicitly scoped to that verified user ID. Using the service client
    // keeps this live aggregate independent of request-token/RLS transport.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return getWhatsAppQuotaStatus(supabaseAdmin, context.userId);
  });
