import type { Tables } from "@/integrations/supabase/types";

export type Property = Tables<"properties">;
export type Room = Tables<"rooms">;
export type Tenant = Tables<"tenants">;
export type Settings = Tables<"settings">;

export const ROOM_TYPES = ["single", "double", "triple", "dormitory"] as const;
export const TENANT_STATUSES = ["active", "vacated", "notice-period"] as const;
export const ADDRESS_PROOF_TYPES = [
  "Aadhaar",
  "Passport",
  "Driving License",
  "Voter ID",
] as const;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return inr.format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Rent actually charged to a tenant: their override, else the room's base rent. */
export function effectiveRent(
  tenant: Pick<Tenant, "monthly_rent_override">,
  room: Pick<Room, "monthly_rent"> | null | undefined,
): number {
  const override = tenant.monthly_rent_override;
  if (override !== null && override !== undefined) return Number(override);
  return Number(room?.monthly_rent ?? 0);
}

export type Occupancy = "vacant" | "partial" | "full";

export function occupancyOf(occupied: number, capacity: number): Occupancy {
  if (occupied <= 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  vacant: "Vacant",
  partial: "Partially occupied",
  full: "Full",
};
