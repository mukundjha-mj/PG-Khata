import type { PlanTier } from "@/lib/pricing-plans";

export type LimitCheck = { allowed: true } | { allowed: false; reason: string };

/** Whether this owner can add one more property under their current tier. */
export function checkPropertyLimit(tier: PlanTier, currentCount: number): LimitCheck {
  if (tier.maxProperties === null) return { allowed: true };
  if (currentCount < tier.maxProperties) return { allowed: true };
  return {
    allowed: false,
    reason:
      tier.maxProperties === 1
        ? `${tier.name} includes 1 property. Upgrade to add more.`
        : `${tier.name} includes up to ${tier.maxProperties} properties. Upgrade to add more.`,
  };
}

/** Whether this owner can add one more room, counted across every property they own. */
export function checkRoomLimit(tier: PlanTier, currentCount: number): LimitCheck {
  if (tier.maxRooms === null) return { allowed: true };
  if (currentCount < tier.maxRooms) return { allowed: true };
  return {
    allowed: false,
    reason: `${tier.name} includes up to ${tier.maxRooms} rooms across all your properties. Upgrade to add more.`,
  };
}

/**
 * Whether this owner can add one more tenant. Unlimited from Growing up.
 * Starter has no flat headcount - rooms can be single/double/triple/4-bed, so
 * the cap is the total bed capacity across every room the owner has.
 */
export function checkTenantLimit(
  tier: PlanTier,
  activeTenantCount: number,
  totalBedCapacity: number,
): LimitCheck {
  if (tier.key !== "starter") return { allowed: true };
  if (activeTenantCount < totalBedCapacity) return { allowed: true };
  return {
    allowed: false,
    reason: `Starter is limited to your rooms' total bed capacity (${totalBedCapacity}). Add more rooms or upgrade to add more tenants.`,
  };
}
