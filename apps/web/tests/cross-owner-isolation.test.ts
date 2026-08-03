import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cross-owner isolation for the two service-role jobs.
 *
 * Both bypass RLS, so scoping is enforced only by the query predicates. These
 * tests assert the predicates exist: owner A's run must never read or write a
 * row belonging to owner B.
 */

const OWNER_A = "admin-a";
const OWNER_B = "admin-b";

type Row = Record<string, unknown>;

const DB: Record<string, Row[]> = {
  admins: [{ id: OWNER_A }, { id: OWNER_B }],
  properties: [
    { id: "prop-a", admin_id: OWNER_A, name: "A House" },
    { id: "prop-b", admin_id: OWNER_B, name: "B House" },
  ],
  rooms: [
    { id: "room-a", property_id: "prop-a", monthly_rent: 5000, room_number: "A1" },
    { id: "room-b", property_id: "prop-b", monthly_rent: 6000, room_number: "B1" },
  ],
  tenants: [
    { id: "ten-a", room_id: "room-a", monthly_rent_override: null, status: "active", full_name: "Asha", email: "asha@example.com" },
    { id: "ten-b", room_id: "room-b", monthly_rent_override: null, status: "active", full_name: "Bimal", email: "bimal@example.com" },
  ],
  settings: [
    { admin_id: OWNER_A, electricity_rate_per_unit: 8, due_date_offset_days: 5, reminder_days_before: 3, remind_on_due_date: true },
    { admin_id: OWNER_B, electricity_rate_per_unit: 9, due_date_offset_days: 5, reminder_days_before: 3, remind_on_due_date: true },
  ],
  bills: [
    { id: "bill-a", tenant_id: "ten-a", property_id: "prop-a", bill_month: "2026-07", total_amount: 5000, paid_amount: 0, due_date: "2026-07-05", status: "pending", approved: true },
    { id: "bill-b", tenant_id: "ten-b", property_id: "prop-b", bill_month: "2026-07", total_amount: 6000, paid_amount: 0, due_date: "2026-07-05", status: "pending", approved: true },
  ],
  electricity_readings: [],
  notification_logs: [],
};

/** Rows the run inserted or updated, so we can assert on writes as well as reads. */
let written: Array<{ table: string; rows: Row[] }>;

function matches(row: Row, filters: Array<[string, string, unknown]>) {
  return filters.every(([col, op, value]) => {
    if (op === "eq") return row[col] === value;
    if (op === "neq") return row[col] !== value;
    if (op === "in") return (value as unknown[]).includes(row[col]);
    if (op === "gte") return String(row[col] ?? "") >= String(value);
    if (op === "lte") return String(row[col] ?? "") <= String(value);
    if (op === "notNull") return row[col] !== null && row[col] !== undefined;
    return true;
  });
}

function makeQuery(table: string) {
  const filters: Array<[string, string, unknown]> = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (c: string, v: unknown) => (filters.push([c, "eq", v]), builder),
    neq: (c: string, v: unknown) => (filters.push([c, "neq", v]), builder),
    in: (c: string, v: unknown) => (filters.push([c, "in", v]), builder),
    gte: (c: string, v: unknown) => (filters.push([c, "gte", v]), builder),
    lte: (c: string, v: unknown) => (filters.push([c, "lte", v]), builder),
    not: (c: string) => (filters.push([c, "notNull", null]), builder),
    update: (patch: Row) => {
      const upd: Record<string, unknown> = {
        in: (c: string, v: unknown[]) => {
          const hit = (DB[table] ?? []).filter((r) => v.includes(r[c]));
          written.push({ table, rows: hit.map((r) => ({ ...r, ...patch })) });
          return Promise.resolve({ data: hit, error: null });
        },
        eq: (c: string, v: unknown) => {
          const hit = (DB[table] ?? []).filter((r) => r[c] === v);
          written.push({ table, rows: hit.map((r) => ({ ...r, ...patch })) });
          return Promise.resolve({ data: hit, error: null });
        },
      };
      return upd;
    },
    upsert: (rows: Row[]) => ({
      select: () => {
        written.push({ table, rows });
        return Promise.resolve({ data: rows.map((_, i) => ({ id: `new-${i}` })), error: null });
      },
    }),
    insert: (rows: Row | Row[]) => {
      written.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
      return Promise.resolve({ data: null, error: null });
    },
    // Awaiting the builder resolves the read.
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: (DB[table] ?? []).filter((r) => matches(r, filters)), error: null }),
  };
  return builder;
}

const fakeClient = { from: (table: string) => makeQuery(table) };

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => fakeClient,
}));

vi.mock("@/lib/email.server", () => ({
  sendTenantEmail: vi.fn(async (_c: unknown, args: { billId: string }) => {
    written.push({ table: "__email", rows: [{ billId: args.billId }] });
    return { sent: true };
  }),
}));

beforeEach(() => {
  written = [];
  process.env["SUPABASE_URL"] = "http://localhost";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-key";
});

describe("runMonthlyBilling cross-owner isolation", () => {
  it("bills only the scoped owner's tenants", async () => {
    const { runMonthlyBilling } = await import("@/lib/billing-run.server");
    const result = await runMonthlyBilling("2026-08", { adminId: OWNER_A });

    expect(result.admins).toBe(1);

    const billRows = written.filter((w) => w.table === "bills").flatMap((w) => w.rows);
    expect(billRows.length).toBeGreaterThan(0);
    for (const row of billRows) {
      expect(row["tenant_id"]).toBe("ten-a");
      expect(row["property_id"]).toBe("prop-a");
    }
  });

  it("never writes a bill for another owner", async () => {
    const { runMonthlyBilling } = await import("@/lib/billing-run.server");
    await runMonthlyBilling("2026-08", { adminId: OWNER_A });

    const touched = written.flatMap((w) => w.rows);
    expect(touched.some((r) => r["tenant_id"] === "ten-b")).toBe(false);
    expect(touched.some((r) => r["property_id"] === "prop-b")).toBe(false);
  });

  it("returns an empty result for an owner with no properties", async () => {
    const { runMonthlyBilling } = await import("@/lib/billing-run.server");
    const result = await runMonthlyBilling("2026-08", { adminId: "admin-unknown" });

    expect(result.admins).toBe(0);
    expect(result.created).toBe(0);
    expect(written).toHaveLength(0);
  });
});

describe("runPaymentReminders cross-owner isolation", () => {
  it("emails only the scoped owner's tenants", async () => {
    const { runPaymentReminders } = await import("@/lib/reminders.server");
    await runPaymentReminders({ today: "2026-07-10", adminId: OWNER_A });

    const emails = written.filter((w) => w.table === "__email").flatMap((w) => w.rows);
    expect(emails.every((e) => e["billId"] === "bill-a")).toBe(true);
    expect(emails.some((e) => e["billId"] === "bill-b")).toBe(false);
  });

  it("never marks another owner's bill overdue", async () => {
    const { runPaymentReminders } = await import("@/lib/reminders.server");
    await runPaymentReminders({ today: "2026-07-10", adminId: OWNER_A });

    const billWrites = written.filter((w) => w.table === "bills").flatMap((w) => w.rows);
    expect(billWrites.some((r) => r["id"] === "bill-b")).toBe(false);
  });

  it("sends nothing for an owner with no properties", async () => {
    const { runPaymentReminders } = await import("@/lib/reminders.server");
    const result = await runPaymentReminders({ today: "2026-07-10", adminId: "admin-unknown" });

    expect(result.candidates).toBe(0);
    expect(written).toHaveLength(0);
  });
});
