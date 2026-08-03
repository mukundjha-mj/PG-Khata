import { describe, expect, it } from "vitest";
import { normalisePhone } from "@/lib/phone";

describe("normalisePhone", () => {
  it.each([
    ["9876543210", "919876543210", "bare ten digits"],
    ["+91 98765 43210", "919876543210", "plus, code and spaces"],
    ["098765-43210", "919876543210", "trunk prefix and dash"],
    ["0091 9876543210", "919876543210", "international access prefix"],
    ["919876543210", "919876543210", "already normalised"],
    ["+91-98765-43210", "919876543210", "dashes throughout"],
    ["  9876543210  ", "919876543210", "surrounding whitespace"],
    ["(+91) 9876543210", "919876543210", "bracketed code"],
  ])("normalises %s -> %s (%s)", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["abcdefghij", "no digits"],
    ["12345", "too short"],
    ["5876543210", "Indian mobiles never start with 5"],
    ["1876543210", "starts with 1"],
    ["98765432", "eight digits"],
    ["9876543210123456", "far too long"],
    ["915876543210", "country code but invalid mobile"],
  ])("rejects %s (%s)", (input) => {
    // A malformed number is not an error at the Cloud API — it just silently
    // messages nobody, so it has to be caught here.
    expect(normalisePhone(input)).toBeNull();
  });

  it("honours a non-Indian dial code", () => {
    expect(normalisePhone("5551234567", "1")).toBe("15551234567");
    expect(normalisePhone("15551234567", "1")).toBe("15551234567");
  });

  it("does not apply the Indian mobile rule to other dial codes", () => {
    // 6-9 is an Indian numbering-plan rule, not a universal one.
    expect(normalisePhone("2071234567", "44")).toBe("442071234567");
  });
});
