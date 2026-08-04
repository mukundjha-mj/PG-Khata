import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The payments ledger is the source of truth for how much a bill has been paid.
 *
 * syncBillTotals recomputes paid_amount as SUM(payments), so any amount written
 * straight onto a bill is erased the next time a payment is recorded. These
 * tests pin that, and pin that settling a bill goes through the ledger.
 */

type Row = Record<string, unknown>;

let bills: Row[];
let payments: Row[];

function billsQuery() {
  const filters: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (c: string, v: unknown) => (filters.push([c, v]), builder),
    single: () => {
      const hit = bills.find((b) => filters.every(([c, v]) => b[c] === v));
      return Promise.resolve(
        hit ? { data: hit, error: null } : { data: null, error: { message: "not found" } },
      );
    },
    update: (patch: Row) => ({
      eq: (c: string, v: unknown) => {
        for (const b of bills) if (b[c] === v) Object.assign(b, patch);
        return Promise.resolve({ error: null });
      },
    }),
  };
  return builder;
}

function paymentsQuery() {
  const filters: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (c: string, v: unknown) => (filters.push([c, v]), builder),
    insert: (row: Row) => {
      payments.push(row);
      return Promise.resolve({ error: null });
    },
    delete: () => ({
      eq: (c: string, v: unknown) => {
        payments = payments.filter((p) => p[c] !== v);
        return Promise.resolve({ error: null });
      },
    }),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      resolve({
        data: payments.filter((p) => filters.every(([c, v]) => p[c] === v)),
        error: null,
      }),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => (table === "bills" ? billsQuery() : paymentsQuery()) },
}));

const BILL_ID = "bill-1";

beforeEach(() => {
  bills = [
    {
      id: BILL_ID,
      total_amount: 5000,
      paid_amount: 0,
      due_date: "2099-01-05",
      status: "pending",
      paid_at: null,
    },
  ];
  payments = [];
});

const bill = () => bills[0]!;

describe("recordPayment", () => {
  it("writes a payments row and derives paid_amount from it", async () => {
    const { recordPayment } = await import("@/lib/billing");
    await recordPayment({ billId: BILL_ID, amount: 2000, method: "UPI", paidAt: "2026-08-04" });

    expect(payments).toHaveLength(1);
    expect(bill()["paid_amount"]).toBe(2000);
    expect(bill()["status"]).toBe("partially-paid");
  });

  it("marks the bill paid once the payments cover the total", async () => {
    const { recordPayment } = await import("@/lib/billing");
    await recordPayment({ billId: BILL_ID, amount: 2000, method: "UPI", paidAt: "2026-08-04" });
    await recordPayment({ billId: BILL_ID, amount: 3000, method: "cash", paidAt: "2026-08-04" });

    expect(payments).toHaveLength(2);
    expect(bill()["paid_amount"]).toBe(5000);
    expect(bill()["status"]).toBe("paid");
    expect(bill()["paid_at"]).not.toBeNull();
  });

  it("rejects a non-positive amount instead of writing a row", async () => {
    const { recordPayment } = await import("@/lib/billing");
    await expect(
      recordPayment({ billId: BILL_ID, amount: 0, method: "cash", paidAt: "2026-08-04" }),
    ).rejects.toThrow();
    expect(payments).toHaveLength(0);
  });
});

describe("settling a bill through the ledger", () => {
  it("pays only the outstanding balance, not the full total", async () => {
    const { balanceOf, recordPayment } = await import("@/lib/billing");
    await recordPayment({ billId: BILL_ID, amount: 2000, method: "UPI", paidAt: "2026-08-04" });

    // What the Bills-list "mark paid" shortcut does.
    const balance = balanceOf(bill() as never);
    expect(balance).toBe(3000);
    await recordPayment({
      billId: BILL_ID,
      amount: balance,
      method: "other",
      paidAt: "2026-08-04",
    });

    const ledgerTotal = payments.reduce((s, p) => s + Number(p["amount"]), 0);
    expect(ledgerTotal).toBe(5000);
    expect(bill()["paid_amount"]).toBe(ledgerTotal);
    expect(bill()["status"]).toBe("paid");
  });

  it("erases a paid_amount written outside the ledger", async () => {
    const { syncBillTotals } = await import("@/lib/billing");
    // The old shortcut: status and paid_amount set on the bill, no payments row.
    Object.assign(bill(), { paid_amount: 5000, status: "paid" });

    await syncBillTotals(BILL_ID);

    // Nothing in the ledger backed that amount, so it is gone.
    expect(bill()["paid_amount"]).toBe(0);
    expect(bill()["status"]).toBe("pending");
  });
});

describe("deletePayment", () => {
  it("re-derives the bill from the remaining payments", async () => {
    const { deletePayment, recordPayment } = await import("@/lib/billing");
    await recordPayment({ billId: BILL_ID, amount: 5000, method: "UPI", paidAt: "2026-08-04" });
    expect(bill()["status"]).toBe("paid");

    payments[0]!["id"] = "pay-1";
    await deletePayment("pay-1", BILL_ID);

    expect(bill()["paid_amount"]).toBe(0);
    expect(bill()["status"]).toBe("pending");
    expect(bill()["paid_at"]).toBeNull();
  });
});
