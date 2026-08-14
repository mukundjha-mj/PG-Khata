import { tierByKey, planRank, type PlanKey } from "@/lib/pricing-plans";

export type BillingCycle = "monthly" | "annual";

export type Proration = {
  from: PlanKey;
  to: PlanKey;
  billingCycle: BillingCycle;
  direction: "upgrade" | "downgrade" | "same";
  /** Days left in the current paid period. */
  daysRemaining: number;
  /** Total days in the current period. */
  periodDays: number;
  /** Unused value of the current plan for the remaining days. */
  creditApplied: number;
  /** Cost of the new plan for the remaining days. */
  newPlanRemainingCost: number;
  /** Amount payable now, rounded to rupees. Zero for downgrades. */
  amountDue: number;
  /** What the account is billed on the next renewal date, for this cycle. */
  nextRenewalAmount: number;
  /** When the change takes effect. */
  effective: "immediately" | "next renewal";
  /** One line plain language summary. */
  summary: string;
  lines: { label: string; value: string }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const days = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

export const rupees = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;

/** The tier's price for one cycle at the given cadence. Falls back to the monthly price if annualAmount is unset. */
const cycleAmount = (tier: { amount: number; annualAmount?: number }, cycle: BillingCycle) =>
  cycle === "annual" ? (tier.annualAmount ?? tier.amount) : tier.amount;

/**
 * Prorates a mid-cycle tier change. Both sides of the change are assumed to
 * be on the same billing cadence - switching cadence itself (monthly to
 * annual or back) only happens at renewal, not mid-cycle, so this never needs
 * to compare a monthly amount against an annual one.
 */
export function computeProration(input: {
  from: string;
  to: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  now?: Date;
  billingCycle?: BillingCycle;
}): Proration {
  const billingCycle = input.billingCycle ?? "monthly";
  const fromTier = tierByKey(input.from);
  const toTier = tierByKey(input.to);
  const fromAmount = cycleAmount(fromTier, billingCycle);
  const toAmount = cycleAmount(toTier, billingCycle);
  const now = input.now ?? new Date();
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);

  const periodDays = Math.max(1, days(start, end));
  const daysRemaining = Math.max(0, Math.min(periodDays, days(now, end)));
  const fraction = daysRemaining / periodDays;

  const direction: Proration["direction"] =
    planRank(toTier.key) > planRank(fromTier.key)
      ? "upgrade"
      : planRank(toTier.key) < planRank(fromTier.key)
        ? "downgrade"
        : "same";

  const creditApplied = round2(fromAmount * fraction);
  const newPlanRemainingCost = round2(toAmount * fraction);
  const rawDue = newPlanRemainingCost - creditApplied;
  const amountDue = direction === "upgrade" ? Math.max(0, Math.round(rawDue)) : 0;

  const cadence = billingCycle === "annual" ? "billed yearly" : "billed monthly";
  const perCycle = billingCycle === "annual" ? "/year" : "/month";
  const perCycleWord = billingCycle === "annual" ? "year" : "month";

  const lines =
    direction === "upgrade"
      ? [
          {
            label: `${toTier.name} for ${daysRemaining} remaining days`,
            value: rupees(newPlanRemainingCost),
          },
          { label: `Unused ${fromTier.name} credit`, value: `- ${rupees(creditApplied)}` },
          { label: "Payable now", value: rupees(amountDue) },
          {
            label: `From ${end.toLocaleDateString("en-IN")}, ${cadence}`,
            value: `${rupees(toAmount)}${perCycle}`,
          },
        ]
      : direction === "downgrade"
        ? [
            {
              label: `${fromTier.name} stays active until`,
              value: end.toLocaleDateString("en-IN"),
            },
            { label: "Charged today", value: "Rs. 0" },
            {
              label: `From next renewal, ${cadence}`,
              value: `${rupees(toAmount)}${perCycle}`,
            },
          ]
        : [{ label: "No change", value: "Rs. 0" }];

  const summary =
    direction === "upgrade"
      ? `You pay ${rupees(amountDue)} now. That is ${toTier.name} for the ${daysRemaining} days left in this cycle, minus ${rupees(creditApplied)} of unused ${fromTier.name} time. From ${end.toLocaleDateString("en-IN")} you are billed ${rupees(toAmount)} every ${perCycleWord}.`
      : direction === "downgrade"
        ? `Nothing is charged today. You keep ${fromTier.name} features until ${end.toLocaleDateString("en-IN")}, then move to ${toTier.name} at ${rupees(toAmount)} per ${perCycleWord}. No refund is issued, the time you already paid for is used first.`
        : "This is already your current plan.";

  return {
    from: fromTier.key,
    to: toTier.key,
    billingCycle,
    direction,
    daysRemaining,
    periodDays,
    creditApplied,
    newPlanRemainingCost,
    amountDue,
    nextRenewalAmount: toAmount,
    effective: direction === "downgrade" ? "next renewal" : "immediately",
    summary,
    lines,
  };
}
