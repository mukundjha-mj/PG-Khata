import { describe, expect, it } from "vitest";
import { buildBillNote, buildUpiIntent, isValidVpa } from "@/lib/upi";

describe("isValidVpa", () => {
  it.each(["owner@okhdfcbank", "pg.manager@ybl", "a_b-c@paytm", "9876543210@upi"])(
    "accepts %s",
    (vpa) => expect(isValidVpa(vpa)).toBe(true),
  );

  it.each([
    ["", "empty"],
    ["ownerokhdfcbank", "no @"],
    ["@ybl", "no handle"],
    ["owner@", "no PSP"],
    ["owner@@ybl", "double @"],
    ["owner@1bank", "PSP starting with a digit"],
    ["own er@ybl", "space in handle"],
  ])("rejects %s (%s)", (vpa) => expect(isValidVpa(vpa)).toBe(false));
});

describe("buildUpiIntent", () => {
  const base = { vpa: "owner@okhdfcbank", payeeName: "Sunrise PG", amount: 8000 };

  it("builds an intent carrying payee, amount and currency", () => {
    const url = new URL(buildUpiIntent(base));
    expect(url.searchParams.get("pa")).toBe("owner@okhdfcbank");
    expect(url.searchParams.get("pn")).toBe("Sunrise PG");
    expect(url.searchParams.get("am")).toBe("8000.00");
    expect(url.searchParams.get("cu")).toBe("INR");
  });

  it("always sends exactly two decimals", () => {
    // A float reaching the PSP unrounded is either rejected or silently
    // truncated to an amount that no longer matches the bill.
    expect(new URL(buildUpiIntent({ ...base, amount: 8000.005 })).searchParams.get("am")).toBe(
      "8000.01",
    );
    expect(new URL(buildUpiIntent({ ...base, amount: 7.5 })).searchParams.get("am")).toBe("7.50");
  });

  it("encodes spaces as %20 rather than +", () => {
    // UPI apps read a literal "+" in the payee name instead of a space.
    const intent = buildUpiIntent(base);
    expect(intent).toContain("Sunrise%20PG");
    expect(intent).not.toContain("+");
  });

  it("strips characters that would break the query string", () => {
    const url = new URL(buildUpiIntent({ ...base, note: "Rent&am=1#Mar" }));
    expect(url.searchParams.get("tn")).toBe("Rent am 1 Mar");
    // The injected am must not have displaced the real amount.
    expect(url.searchParams.get("am")).toBe("8000.00");
  });

  it("omits the note when it sanitises to nothing", () => {
    expect(new URL(buildUpiIntent({ ...base, note: "###" })).searchParams.has("tn")).toBe(false);
  });

  it.each([
    ["bad-vpa", "Invalid UPI ID"],
    ["", "Invalid UPI ID"],
  ])("refuses to build for %s", (vpa, message) => {
    expect(() => buildUpiIntent({ ...base, vpa })).toThrow(message);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects the amount %s", (amount) => {
    expect(() => buildUpiIntent({ ...base, amount })).toThrow("positive number");
  });

  it("rejects an amount over the per-transaction limit", () => {
    // A silently failing QR is worse than an explicit refusal.
    expect(() => buildUpiIntent({ ...base, amount: 100001 })).toThrow("1,00,000");
    expect(() => buildUpiIntent({ ...base, amount: 100000 })).not.toThrow();
  });
});

describe("buildBillNote", () => {
  it("names the month and room", () => {
    expect(buildBillNote("Mar 2026", "12")).toBe("Rent Mar 2026 Room 12");
  });
});
