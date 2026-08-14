import { describe, expect, it } from "vitest";
import { loadPlatformStats } from "@/lib/super-admin.server";

type Row = Record<string, unknown>;

/**
 * Minimal fake matching just the shape loadPlatformStats reads: every call
 * is `.select(...)` optionally followed by `.gte(...)`, then awaited.
 */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => {
      const rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        gte: () => builder,
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      };
      return builder;
    },
    // Cast to the shape the function expects; only .from is exercised here.
  } as unknown as Parameters<typeof loadPlatformStats>[0];
}

const baseTables = {
  admins: [{ id: "a1", created_at: "2020-01-01T00:00:00Z" }],
  properties: [],
  rooms: [],
  tenants: [],
  bills: [],
  payments: [],
  plan_payments: [],
};

describe("loadPlatformStats MRR normalization", () => {
  it("counts a monthly active Starter subscriber at the full monthly amount", async () => {
    const db = fakeDb({
      ...baseTables,
      settings: [
        { admin_id: "a1", plan: "starter", plan_status: "active", billing_cycle: "monthly" },
      ],
    });
    const stats = await loadPlatformStats(db);
    expect(stats.mrr).toBe(499);
  });

  it("normalizes an annual Starter subscriber to a monthly-equivalent figure, not the full annual charge", async () => {
    const db = fakeDb({
      ...baseTables,
      settings: [
        { admin_id: "a1", plan: "starter", plan_status: "active", billing_cycle: "annual" },
      ],
    });
    const stats = await loadPlatformStats(db);
    // annualAmount 4990 / 12, not the bare monthly `amount` (499) and
    // nowhere near the full annual charge (4990) landing in a monthly figure.
    expect(stats.mrr).toBeCloseTo(4990 / 12, 2);
    expect(stats.mrr).not.toBe(499);
    expect(stats.mrr).not.toBe(4990);
  });

  it("mixes monthly and annual subscribers correctly without double-counting", async () => {
    const db = fakeDb({
      ...baseTables,
      admins: [
        { id: "a1", created_at: "2020-01-01T00:00:00Z" },
        { id: "a2", created_at: "2020-01-01T00:00:00Z" },
      ],
      settings: [
        { admin_id: "a1", plan: "growing", plan_status: "active", billing_cycle: "monthly" },
        { admin_id: "a2", plan: "growing", plan_status: "active", billing_cycle: "annual" },
      ],
    });
    const stats = await loadPlatformStats(db);
    expect(stats.mrr).toBeCloseTo(799 + 7990 / 12, 2);
    expect(stats.payingOwners).toBe(2);
  });

  it("does not count a trial account toward MRR regardless of billing_cycle", async () => {
    const db = fakeDb({
      ...baseTables,
      settings: [{ admin_id: "a1", plan: "scale", plan_status: "trial", billing_cycle: "annual" }],
    });
    const stats = await loadPlatformStats(db);
    expect(stats.mrr).toBe(0);
    expect(stats.trialOwners).toBe(1);
  });
});
