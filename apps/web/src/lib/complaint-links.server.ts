import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateLinkToken } from "@/lib/tokens.server";

type Client = SupabaseClient<Database>;

/** Fetches the one complaint link for a property, creating it on first call. */
export async function getOrCreateComplaintLink(supabase: Client, propertyId: string) {
  const existing = await supabase
    .from("property_complaint_links")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from("property_complaint_links")
    .insert({ property_id: propertyId, token: generateLinkToken() })
    .select("*")
    .single();
  if (created.error) throw created.error;
  return created.data;
}

export async function regenerateComplaintLink(supabase: Client, propertyId: string) {
  const { data, error } = await supabase
    .from("property_complaint_links")
    .update({ token: generateLinkToken() })
    .eq("property_id", propertyId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setComplaintLinkActive(
  supabase: Client,
  propertyId: string,
  isActive: boolean,
) {
  const { data, error } = await supabase
    .from("property_complaint_links")
    .update({ is_active: isActive })
    .eq("property_id", propertyId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
