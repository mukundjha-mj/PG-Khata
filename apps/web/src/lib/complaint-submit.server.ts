import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidEmailFormat, toWhatsAppPhoneOrNull } from "@/lib/contact-validation";

export type ComplaintLinkInfo = {
  propertyId: string;
  adminId: string;
  propertyName: string;
};

/** Resolves a complaint token to its property, or null if unknown/inactive. */
export async function resolveComplaintLink(token: string): Promise<ComplaintLinkInfo | null> {
  if (!token) return null;
  const { data, error } = await supabaseAdmin
    .from("property_complaint_links")
    .select("property_id, admin_id, is_active, properties(name)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  const propertyName = (data as { properties?: { name?: string } | null }).properties?.name;
  if (!propertyName) return null;
  return { propertyId: data.property_id, adminId: data.admin_id, propertyName };
}

export type ComplaintSubmitInput = {
  tenant_name: string;
  room_number: string;
  phone: string;
  email?: string | undefined;
  note: string;
};

export class ComplaintError extends Error {}

export async function createComplaint(token: string, input: ComplaintSubmitInput) {
  const link = await resolveComplaintLink(token);
  if (!link) throw new ComplaintError("This complaint link is no longer active.");

  const tenant_name = input.tenant_name.trim();
  const room_number = input.room_number.trim();
  const note = input.note.trim();
  if (!tenant_name) throw new ComplaintError("Name is required.");
  if (!room_number) throw new ComplaintError("Room number is required.");
  if (!note) throw new ComplaintError("Please describe the issue.");

  // Re-validated here (not just in the browser): the form only ever collects
  // an Indian WhatsApp number and enforces it with a fixed +91 prefix, but a
  // direct API call could send anything, so the shape is enforced again.
  const phone = toWhatsAppPhoneOrNull(input.phone);
  if (!phone) throw new ComplaintError("Enter a valid 10-digit WhatsApp number.");

  const email = input.email?.trim() || null;
  if (email && !isValidEmailFormat(email)) throw new ComplaintError("Enter a valid email address.");

  const { error } = await supabaseAdmin.from("complaints").insert({
    property_id: link.propertyId,
    admin_id: link.adminId,
    tenant_name,
    room_number,
    phone,
    email,
    note,
  });
  if (error) throw new ComplaintError("Could not submit your complaint. Please try again.");
}
