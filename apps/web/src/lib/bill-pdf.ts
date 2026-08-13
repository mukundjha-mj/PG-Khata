import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/pg";
import { BRAND } from "@/lib/site";
import type { ElectricitySplit } from "@/lib/electricity-split";

// jsPDF's built-in Helvetica has no rupee glyph, so PDFs use "Rs." instead.
function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `Rs. ${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export type Bill = Tables<"bills">;

export type BillContext = {
  tenant?: { full_name: string; phone: string | null } | null;
  room?: { room_number: string } | null;
  property?: { name: string; address: string | null; city: string | null } | null;
  monthLabel: string;
  electricitySplit?: ElectricitySplit | null;
};

type Charge = { label?: string; amount?: number };

function charges(bill: Bill): Charge[] {
  const raw = bill.other_charges;
  return Array.isArray(raw) ? (raw as Charge[]) : [];
}

const INK: [number, number, number] = [15, 23, 42];
const MUTED = [100, 116, 139] as const;
const ACCENT = [79, 70, 229] as const;

/** Renders one invoice starting at the current page; returns the y position after it. */
function renderBill(doc: jsPDF, bill: Bill, ctx: BillContext) {
  const m = 48;
  const right = doc.internal.pageSize.getWidth() - m;

  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, "F");

  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(ctx.property?.name ?? BRAND, m, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const addr = [ctx.property?.address, ctx.property?.city].filter(Boolean).join(", ");
  if (addr) doc.text(addr, m, 74);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("RENT INVOICE", right, 60, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(ctx.monthLabel, right, 74, { align: "right" });
  doc.text(`No. ${bill.id.slice(0, 8).toUpperCase()}`, right, 86, { align: "right" });

  const left: string[] = [
    `Tenant: ${ctx.tenant?.full_name ?? "-"}`,
    `Phone: ${ctx.tenant?.phone ?? "-"}`,
    `Room: ${ctx.room?.room_number ?? "-"}`,
  ];
  const meta: string[] = [
    `Billing cycle: ${formatDate(bill.billing_cycle_start)} – ${formatDate(bill.billing_cycle_end)}`,
    `Due date: ${formatDate(bill.due_date)}`,
    `Status: ${bill.status}`,
  ];
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFontSize(10);
  left.forEach((line, i) => doc.text(line, m, 116 + i * 14));
  meta.forEach((line, i) => doc.text(line, right, 116 + i * 14, { align: "right" }));

  type Row = (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[];
  const rows: Row[] = [["Rent", formatMoney(bill.rent_amount)]];
  const units = bill.electricity_units_consumed;
  rows.push([
    units ? `Electricity (${units} units)` : "Electricity",
    formatMoney(bill.electricity_amount),
  ]);
  const split = ctx.electricitySplit;
  if (split && split.occupancy > 1) {
    rows.push([
      {
        content: `   Room total: ${split.totalUnits} units ÷ ${split.occupancy} tenants`,
        colSpan: 2,
        styles: { fontSize: 8, textColor: MUTED, fontStyle: "italic" },
      },
    ]);
  }
  for (const c of charges(bill)) {
    rows.push([c.label || "Other charges", formatMoney(c.amount ?? 0)]);
  }

  autoTable(doc, {
    startY: 176,
    margin: { left: m, right: m },
    head: [["Description", "Amount"]],
    body: rows,
    foot: [
      ["Total due", formatMoney(bill.total_amount)],
      ...(Number(bill.paid_amount) > 0
        ? ([
            ["Paid", formatMoney(bill.paid_amount)],
            ["Balance", formatMoney(Number(bill.total_amount) - Number(bill.paid_amount))],
          ] as [string, string][])
        : []),
    ],
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [241, 245, 249], textColor: INK },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: INK,
      fontStyle: "bold",
    },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (d) => {
      if (d.column.index === 1) d.cell.styles.halign = "right";
    },
  });

  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    bill.status === "paid"
      ? "Payment received. Thank you."
      : "Please clear the balance on or before the due date.",
    m,
    endY + 28,
  );
  return endY;
}

function safe(name: string) {
  return name
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function downloadBillPdf(bill: Bill, ctx: BillContext) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderBill(doc, bill, ctx);
  doc.save(`bill-${safe(ctx.tenant?.full_name ?? "tenant")}-${bill.bill_month}.pdf`);
}

export function downloadMonthPdf(
  bills: Bill[],
  contextFor: (bill: Bill) => BillContext,
  month: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  bills.forEach((bill, i) => {
    if (i > 0) doc.addPage();
    renderBill(doc, bill, contextFor(bill));
  });
  doc.save(`bills-${month}.pdf`);
}
