import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Bill = Tables<"bills">;
export type Payment = Tables<"payments">;
export type Reading = Tables<"electricity_readings">;

export const PAYMENT_METHODS = ["UPI", "cash", "bank-transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthOptions(count = 12): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = -1; i < count - 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y) return month;
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function cycleFor(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

/** Amount still owed on a bill. */
export function balanceOf(bill: Pick<Bill, "total_amount" | "paid_amount">): number {
  return Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount));
}

export function isOverdue(bill: Pick<Bill, "status" | "due_date" | "total_amount" | "paid_amount">) {
  if (balanceOf(bill) <= 0) return false;
  if (!bill.due_date) return false;
  return bill.due_date < new Date().toISOString().slice(0, 10);
}

export type DisplayStatus = "paid" | "partially-paid" | "overdue" | "pending";

export function displayStatus(
  bill: Pick<Bill, "status" | "due_date" | "total_amount" | "paid_amount">,
): DisplayStatus {
  if (balanceOf(bill) <= 0) return "paid";
  if (isOverdue(bill)) return "overdue";
  if (Number(bill.paid_amount) > 0) return "partially-paid";
  return "pending";
}

export const STATUS_STYLE: Record<DisplayStatus, string> = {
  paid: "border-transparent bg-success/15 text-success",
  "partially-paid": "border-transparent bg-warning/20 text-warning-foreground",
  overdue: "border-transparent bg-destructive/15 text-destructive",
  pending: "text-muted-foreground",
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  paid: "Paid",
  "partially-paid": "Partly paid",
  overdue: "Overdue",
  pending: "Pending",
};

/**
 * Records a payment against a bill and re-syncs the bill's paid amount and
 * status from the full payment history (so edits and deletes stay correct).
 */
export async function recordPayment(input: {
  billId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  transactionRef?: string | null;
  notes?: string | null;
}) {
  if (!(input.amount > 0)) throw new Error("Enter an amount greater than zero.");
  const { error: insertError } = await supabase.from("payments").insert({
    bill_id: input.billId,
    amount: input.amount,
    payment_method: input.method,
    paid_at: new Date(`${input.paidAt}T12:00:00`).toISOString(),
    transaction_ref: input.transactionRef || null,
    notes: input.notes || null,
  });
  if (insertError) throw insertError;
  return syncBillTotals(input.billId);
}

/** Recomputes paid_amount / status / paid_at for a bill from its payments. */
export async function syncBillTotals(billId: string) {
  const [{ data: bill, error: billError }, { data: payments, error: payError }] = await Promise.all([
    supabase.from("bills").select("total_amount, due_date").eq("id", billId).single(),
    supabase.from("payments").select("amount, paid_at").eq("bill_id", billId),
  ]);
  if (billError) throw billError;
  if (payError) throw payError;

  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(bill.total_amount);
  const today = new Date().toISOString().slice(0, 10);
  const status: DisplayStatus =
    paid >= total && total > 0
      ? "paid"
      : paid > 0
        ? "partially-paid"
        : bill.due_date && bill.due_date < today
          ? "overdue"
          : "pending";
  const lastPaidAt = (payments ?? [])
    .map((p) => p.paid_at)
    .sort()
    .at(-1);

  const { error } = await supabase
    .from("bills")
    .update({
      paid_amount: paid,
      status,
      paid_at: status === "paid" ? (lastPaidAt ?? new Date().toISOString()) : null,
    })
    .eq("id", billId);
  if (error) throw error;
  return { paid, status };
}

export async function deletePayment(paymentId: string, billId: string) {
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) throw error;
  return syncBillTotals(billId);
}

/** Triggers a browser download of rows as CSV. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
