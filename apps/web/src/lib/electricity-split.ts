/**
 * How a room's electricity reading gets divided across the tenants billed
 * for it in one month.
 *
 * Charging is already split evenly at billing time (billing-run.server.ts /
 * tenant-billing.server.ts) - this only reconstructs the same numbers
 * afterward, for showing the math to a tenant. Nothing here changes any
 * amount that was actually charged.
 */

export type ElectricitySplit = {
  /** Sum of electricity_units_consumed across every sibling bill. */
  totalUnits: number;
  /** How many tenants were billed for this room in this month. */
  occupancy: number;
};

/**
 * Computes the split from a list of sibling bills' consumed units.
 *
 * Pure so it can run identically on the server (WhatsApp/email) and in the
 * browser (PDF export), which already has every bill for the month loaded.
 */
export function computeElectricitySplit(siblingUnits: Array<number | null>): ElectricitySplit {
  const occupancy = siblingUnits.length;
  const totalUnits = siblingUnits.reduce((sum: number, u) => sum + Number(u ?? 0), 0);
  return { totalUnits, occupancy };
}

/**
 * "125 of 250 units - split 2 ways", or just "125 units" when there is
 * nothing to explain (single occupant, or the split could not be
 * determined).
 */
export function formatElectricityUnits(units: number, split: ElectricitySplit | null): string {
  if (!split || split.occupancy <= 1) return `${units} units`;
  return `${units} of ${split.totalUnits} units - split ${split.occupancy} ways`;
}
