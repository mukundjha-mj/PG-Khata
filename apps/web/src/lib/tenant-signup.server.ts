import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ADDRESS_PROOF_TYPES } from "@/lib/pg";
import { isValidEmailFormat, toWhatsAppPhoneOrNull } from "@/lib/contact-validation";

const ADDRESS_PROOF_BUCKET = "tenant-documents";
const ADDRESS_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const ADDRESS_PROOF_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type PublicVacantRoom = {
  id: string;
  room_number: string;
};

export type SignupLinkInfo = {
  propertyId: string;
  adminId: string;
  propertyName: string;
};

/** Resolves a signup token to its property, or null if unknown/inactive. */
export async function resolveSignupLink(token: string): Promise<SignupLinkInfo | null> {
  if (!token) return null;
  const { data, error } = await supabaseAdmin
    .from("property_signup_links")
    .select("property_id, admin_id, is_active, properties(name)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  const propertyName = (data as { properties?: { name?: string } | null }).properties?.name;
  if (!propertyName) return null;
  return { propertyId: data.property_id, adminId: data.admin_id, propertyName };
}

/**
 * Rooms in a property with at least one free bed. Only the room number is
 * returned - rent and room type stay internal to the owner, since the tenant
 * picking their room is only confirming which physical room they're in, not
 * shopping between options.
 */
export async function listVacantRooms(propertyId: string): Promise<PublicVacantRoom[]> {
  const roomsRes = await supabaseAdmin
    .from("rooms")
    .select("id, room_number, capacity")
    .eq("property_id", propertyId)
    .order("room_number");
  if (roomsRes.error) throw roomsRes.error;

  const roomIds = (roomsRes.data ?? []).map((r) => r.id);
  const tenantsRes = roomIds.length
    ? await supabaseAdmin
        .from("tenants")
        .select("room_id")
        .eq("status", "active")
        .in("room_id", roomIds)
    : { data: [], error: null };
  if (tenantsRes.error) throw tenantsRes.error;

  const occupied = new Map<string, number>();
  for (const t of tenantsRes.data ?? []) {
    occupied.set(t.room_id, (occupied.get(t.room_id) ?? 0) + 1);
  }

  return (roomsRes.data ?? [])
    .filter((r) => (occupied.get(r.id) ?? 0) < r.capacity)
    .map((r) => ({
      id: r.id,
      room_number: r.room_number,
    }));
}

export type TenantSignupInput = {
  roomId: string;
  full_name: string;
  phone: string;
  alternate_phone?: string | undefined;
  email?: string | undefined;
  permanent_address?: string | undefined;
  emergency_contact_name?: string | undefined;
  emergency_contact_phone?: string | undefined;
  address_proof_type?: string | undefined;
  address_proof_file?: File | undefined;
  joining_date?: string | undefined;
};

/** Friendly errors only - never the raw Postgres message, and never confirms whose record collided. */
export class SignupError extends Error {}

function validateAddressProof(input: TenantSignupInput) {
  const proofType = input.address_proof_type?.trim() || null;
  const proofFile = input.address_proof_file;

  if (!proofType && !proofFile) return null;
  if (!proofType) throw new SignupError("Choose the address proof type for the uploaded document.");
  if (!(ADDRESS_PROOF_TYPES as readonly string[]).includes(proofType)) {
    throw new SignupError("Choose a valid address proof type.");
  }
  if (!proofFile) throw new SignupError(`Upload your ${proofType} document.`);
  if (!proofFile.size) throw new SignupError("The address proof file is empty.");
  if (proofFile.size > ADDRESS_PROOF_MAX_BYTES) {
    throw new SignupError("Address proof files must be 5 MB or smaller.");
  }

  const extension =
    ADDRESS_PROOF_EXTENSIONS[proofFile.type as keyof typeof ADDRESS_PROOF_EXTENSIONS];
  if (!extension) {
    throw new SignupError("Upload a JPEG, PNG, WebP, or PDF address proof.");
  }

  return {
    proofType: proofType as (typeof ADDRESS_PROOF_TYPES)[number],
    proofFile,
    extension,
  };
}

async function removeAddressProof(path: string) {
  const { error } = await supabaseAdmin.storage.from(ADDRESS_PROOF_BUCKET).remove([path]);
  if (error) console.error("[tenant-signup] address proof cleanup failed", error);
}

export async function createSignupTenant(token: string, input: TenantSignupInput) {
  const link = await resolveSignupLink(token);
  if (!link) throw new SignupError("This signup link is no longer active.");

  const full_name = input.full_name.trim();
  if (!full_name) throw new SignupError("Name is required.");
  if (!input.roomId) throw new SignupError("Pick a room.");

  // Re-validated here (not just in the browser): the form only ever collects
  // an Indian WhatsApp number and enforces it with a fixed +91 prefix, but a
  // direct API call could send anything, so the shape is enforced again.
  const phone = toWhatsAppPhoneOrNull(input.phone);
  if (!phone) throw new SignupError("Enter a valid 10-digit WhatsApp number.");

  let alternate_phone: string | null = null;
  if (input.alternate_phone?.trim()) {
    alternate_phone = toWhatsAppPhoneOrNull(input.alternate_phone);
    if (!alternate_phone) throw new SignupError("Alternate phone must be a valid 10-digit number.");
  }

  let emergency_contact_phone: string | null = null;
  if (input.emergency_contact_phone?.trim()) {
    emergency_contact_phone = toWhatsAppPhoneOrNull(input.emergency_contact_phone);
    if (!emergency_contact_phone) {
      throw new SignupError("Emergency phone must be a valid 10-digit number.");
    }
  }

  const email = input.email?.trim() || null;
  if (email && !isValidEmailFormat(email)) throw new SignupError("Enter a valid email address.");
  const addressProof = validateAddressProof(input);

  const room = await supabaseAdmin
    .from("rooms")
    .select("id, property_id, capacity")
    .eq("id", input.roomId)
    .eq("property_id", link.propertyId)
    .maybeSingle();
  if (room.error) throw room.error;
  if (!room.data) throw new SignupError("That room is not available.");

  const activeInRoom = await supabaseAdmin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("room_id", input.roomId)
    .eq("status", "active");
  if (activeInRoom.error) throw activeInRoom.error;
  if ((activeInRoom.count ?? 0) >= room.data.capacity) {
    throw new SignupError("That room just filled up. Please pick another room.");
  }

  let address_proof_file_url: string | null = null;
  if (addressProof) {
    address_proof_file_url = `${link.adminId}/signup/${crypto.randomUUID()}.${addressProof.extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ADDRESS_PROOF_BUCKET)
      .upload(address_proof_file_url, addressProof.proofFile, {
        contentType: addressProof.proofFile.type,
        upsert: false,
      });
    if (uploadError) {
      console.error("[tenant-signup] address proof upload failed", uploadError);
      throw new SignupError("Could not upload the address proof. Please try again.");
    }
  }

  const { error } = await supabaseAdmin.from("tenants").insert({
    room_id: input.roomId,
    full_name,
    phone,
    alternate_phone,
    email,
    permanent_address: input.permanent_address?.trim() || null,
    emergency_contact_name: input.emergency_contact_name?.trim() || null,
    emergency_contact_phone,
    address_proof_type: addressProof?.proofType ?? null,
    address_proof_file_url,
    joining_date: input.joining_date || new Date().toISOString().slice(0, 10),
    status: "active",
  });

  if (error) {
    if (address_proof_file_url) await removeAddressProof(address_proof_file_url);
    if (error.code === "23505") {
      throw new SignupError(
        "A tenant with this phone number already exists. Contact the property owner if you believe this is an error.",
      );
    }
    throw new SignupError("Could not complete signup. Please try again.");
  }
}
