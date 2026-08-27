import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getWhatsAppQuotaStatus, type QuotaStatus } from "@/lib/whatsapp-quota.server";

/** Returns the signed-in owner's live WhatsApp usage for the current calendar month. */
export const getMyWhatsAppQuotaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<QuotaStatus> =>
      getWhatsAppQuotaStatus(context.supabase, context.userId),
  );
