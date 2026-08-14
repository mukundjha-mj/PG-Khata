import { describe, expect, it } from "vitest";
import { computeProration } from "@/lib/plan-proration";

const PERIOD_START = "2026-08-01";
const PERIOD_END = "2026-08-31"; // 30-day period

describe("computeProration - monthly (default)", () => {
  it("prorates an upgrade against monthly amounts when billingCycle is omitted", () => {
    const p = computeProration({
      from: "starter",
      to: "growing",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      now: new Date("2026-08-16T00:00:00Z"), // 15 days remaining
    });
    expect(p.billingCycle).toBe("monthly");
    expect(p.direction).toBe("upgrade");
    // starter=499, growing=799, 15/30 of each
    expect(p.creditApplied).toBeCloseTo(249.5, 1);
    expect(p.newPlanRemainingCost).toBeCloseTo(399.5, 1);
    expect(p.amountDue).toBe(150); // rounded (399.5 - 249.5)
    expect(p.nextRenewalAmount).toBe(799);
  });

  it("charges nothing today for a downgrade and reports the lower monthly renewal", () => {
    const p = computeProration({
      from: "scale",
      to: "starter",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      now: new Date("2026-08-16T00:00:00Z"),
    });
    expect(p.direction).toBe("downgrade");
    expect(p.amountDue).toBe(0);
    expect(p.nextRenewalAmount).toBe(499);
    expect(p.effective).toBe("next renewal");
  });

  it("says billed monthly in the summary and lines when on the monthly cycle", () => {
    const p = computeProration({
      from: "starter",
      to: "growing",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      now: new Date("2026-08-16T00:00:00Z"),
    });
    expect(p.summary).toContain("every month");
    expect(p.lines.some((l) => l.label.includes("billed monthly"))).toBe(true);
  });
});

describe("computeProration - annual", () => {
  const ANNUAL_START = "2026-01-01";
  const ANNUAL_END = "2027-01-01"; // 365-day period

  it("prorates an upgrade against annualAmount, not the monthly amount", () => {
    const p = computeProration({
      from: "starter",
      to: "growing",
      periodStart: ANNUAL_START,
      periodEnd: ANNUAL_END,
      now: new Date("2026-07-02T00:00:00Z"), // ~half the year remaining
      billingCycle: "annual",
    });
    expect(p.billingCycle).toBe("annual");
    expect(p.direction).toBe("upgrade");
    // starter annual=4990, growing annual=7990. A monthly-amount bug would
    // instead use 499/799, producing a far smaller creditApplied/amountDue.
    const fraction = p.daysRemaining / p.periodDays;
    expect(p.creditApplied).toBeCloseTo(4990 * fraction, 0);
    expect(p.newPlanRemainingCost).toBeCloseTo(7990 * fraction, 0);
    expect(p.nextRenewalAmount).toBe(7990);
  });

  it("says billed yearly and /year in the annual summary and lines", () => {
    const p = computeProration({
      from: "starter",
      to: "growing",
      periodStart: ANNUAL_START,
      periodEnd: ANNUAL_END,
      now: new Date("2026-07-02T00:00:00Z"),
      billingCycle: "annual",
    });
    expect(p.summary).toContain("every year");
    expect(p.lines.some((l) => l.label.includes("billed yearly"))).toBe(true);
    expect(p.lines.some((l) => l.value.includes("/year"))).toBe(true);
  });

  it("charges nothing today for an annual downgrade and reports the lower annual renewal", () => {
    const p = computeProration({
      from: "scale",
      to: "starter",
      periodStart: ANNUAL_START,
      periodEnd: ANNUAL_END,
      now: new Date("2026-07-02T00:00:00Z"),
      billingCycle: "annual",
    });
    expect(p.direction).toBe("downgrade");
    expect(p.amountDue).toBe(0);
    expect(p.nextRenewalAmount).toBe(4990);
  });
});
