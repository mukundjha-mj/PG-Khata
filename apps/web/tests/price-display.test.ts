import { describe, expect, it } from "vitest";
import { computeDiscount } from "@/lib/price-display";

describe("computeDiscount", () => {
  it("computes amount saved and percent off", () => {
    expect(computeDiscount(5000, 2999)).toEqual({ amountSaved: 2001, discountPercent: 40 });
  });

  it("rounds the percent to 1 decimal place", () => {
    expect(computeDiscount(999, 799).discountPercent).toBeCloseTo(20, 1);
  });

  it("treats a sale price at or above MRP as no discount", () => {
    expect(computeDiscount(499, 499)).toEqual({ amountSaved: 0, discountPercent: 0 });
    expect(computeDiscount(499, 599)).toEqual({ amountSaved: 0, discountPercent: 0 });
  });

  it("does not divide by zero when MRP is zero", () => {
    expect(computeDiscount(0, 0)).toEqual({ amountSaved: 0, discountPercent: 0 });
  });
});
