import { describe, expect, it } from "vitest";
import {
  CYCLE_DAYS,
  DUE_SOON_DAYS,
  GRACE_DAYS,
  describePlanPeriod,
  nextPeriod,
  toDateString,
} from "@/lib/plan-period";

/** The period ends on the 10th, so the buffer covers the 11th to the 17th. */
const DUE = "2026-08-10";
const on = (day: string, planStatus = "active") =>
  describePlanPeriod({ periodEnd: DUE, planStatus, now: new Date(`${day}T12:00:00`) });

describe("describePlanPeriod phases", () => {
  it("is active while the due date is further out than the nudge window", () => {
    expect(on("2026-08-04").phase).toBe("active");
    expect(on("2026-07-20").phase).toBe("active");
  });

  it("switches to due_soon exactly DUE_SOON_DAYS before the due date", () => {
    expect(on("2026-08-05").daysUntilDue).toBe(DUE_SOON_DAYS);
    expect(on("2026-08-05").phase).toBe("due_soon");
    expect(on("2026-08-04").phase).toBe("active");
  });

  it("is still due_soon on the due date itself, not overdue", () => {
    const p = on("2026-08-10");
    expect(p.daysUntilDue).toBe(0);
    expect(p.phase).toBe("due_soon");
    expect(p.isOverdue).toBe(false);
  });

  it("enters the buffer the day after the due date", () => {
    const p = on("2026-08-11");
    expect(p.phase).toBe("grace");
    expect(p.isOverdue).toBe(false);
  });

  it("counts the buffer inclusively, so the whole window is usable", () => {
    // The owner gets GRACE_DAYS of buffer, not GRACE_DAYS minus one.
    expect(on("2026-08-11").bufferDaysLeft).toBe(GRACE_DAYS);
    expect(on("2026-08-16").bufferDaysLeft).toBe(2);
    expect(on("2026-08-17").bufferDaysLeft).toBe(1);
  });

  it("treats the last buffer day as still inside the buffer", () => {
    expect(on("2026-08-17").phase).toBe("grace");
    expect(toDateString(on("2026-08-17").bufferEnd)).toBe("2026-08-17");
  });

  it("lapses only once the buffer is fully spent", () => {
    const p = on("2026-08-18");
    expect(p.phase).toBe("lapsed");
    expect(p.bufferDaysLeft).toBe(0);
    expect(p.isOverdue).toBe(true);
  });

  it("never reports more buffer than exists, even long before the due date", () => {
    expect(on("2026-07-01").bufferDaysLeft).toBe(GRACE_DAYS);
  });

  it("flags every non-active phase as needing payment", () => {
    expect(on("2026-08-04").needsPayment).toBe(false);
    for (const day of ["2026-08-05", "2026-08-10", "2026-08-14", "2026-08-25"]) {
      expect(on(day).needsPayment, day).toBe(true);
    }
  });
});

describe("describePlanPeriod copy", () => {
  it("says trial rather than plan while on the signup trial", () => {
    expect(on("2026-08-08", "trial").title).toContain("free trial");
    expect(on("2026-08-08", "active").title).not.toContain("trial");
  });

  it("names the buffer in the due_soon message so a late payment is not a surprise", () => {
    expect(on("2026-08-08").detail).toContain("7 buffer days");
  });

  it("tells a lapsed owner their data is safe, since access is never cut", () => {
    expect(on("2026-08-25").detail).toContain("data is safe");
  });

  it("singularises a one day countdown", () => {
    expect(on("2026-08-09").title).toBe("Your plan ends in 1 day");
    expect(on("2026-08-08").title).toBe("Your plan ends in 2 days");
    expect(on("2026-08-10").title).toBe("Your plan ends today");
  });

  it("singularises the last buffer day", () => {
    expect(on("2026-08-17").title).toContain("1 buffer day left");
    expect(on("2026-08-16").title).toContain("2 buffer days left");
  });
});

describe("nextPeriod", () => {
  it("anchors to the old due date inside the buffer so the billing day never drifts", () => {
    const p = nextPeriod({ periodEnd: DUE, now: new Date("2026-08-15T12:00:00") });
    expect(p.anchored).toBe(true);
    expect(p.start).toBe("2026-08-10");
    expect(p.end).toBe("2026-09-09");
  });

  it("anchors on the last buffer day too", () => {
    expect(nextPeriod({ periodEnd: DUE, now: new Date("2026-08-17T12:00:00") }).anchored).toBe(
      true,
    );
  });

  it("restarts from today once the buffer is gone, so nobody pays for past days", () => {
    const p = nextPeriod({ periodEnd: DUE, now: new Date("2026-09-01T12:00:00") });
    expect(p.anchored).toBe(false);
    expect(p.start).toBe("2026-09-01");
    expect(p.end).toBe("2026-10-01");
  });

  it("gives a full cycle either way", () => {
    for (const now of ["2026-08-15", "2026-09-01"]) {
      const p = nextPeriod({ periodEnd: DUE, now: new Date(`${now}T12:00:00`) });
      const days = (new Date(p.end).getTime() - new Date(p.start).getTime()) / 86_400_000;
      expect(days, now).toBe(CYCLE_DAYS);
    }
  });

  it("keeps renewing early from the existing end date", () => {
    // Paying a week early must not shorten the cycle the owner already paid for.
    expect(nextPeriod({ periodEnd: DUE, now: new Date("2026-08-03T12:00:00") }).start).toBe(DUE);
  });
});

describe("date handling", () => {
  it("reads a Postgres date column without drifting a day in +05:30", () => {
    // "2026-08-10" parses as UTC midnight while now() is local; a naive
    // subtraction lands on 9 or 11 August depending on the server's offset.
    expect(on("2026-08-10").daysUntilDue).toBe(0);
  });

  it("is stable across the time of day", () => {
    for (const time of ["00:05:00", "12:00:00", "23:55:00"]) {
      const p = describePlanPeriod({ periodEnd: DUE, now: new Date(`2026-08-12T${time}`) });
      expect(p.bufferDaysLeft, time).toBe(6);
    }
  });

  it("round trips a normalised date", () => {
    expect(toDateString(new Date("2026-08-10T00:00:00Z"))).toBe("2026-08-10");
  });

  it("rejects an unparseable date", () => {
    expect(() => describePlanPeriod({ periodEnd: "not a date" })).toThrow("Invalid date");
  });
});
