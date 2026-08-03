import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { tierByKey } from "@/lib/pricing-plans";

// jsPDF's built-in Helvetica has no rupee glyph, so receipts use "Rs." instead.
const money = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return `Rs. ${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export type PlanChangeRow = {
  id: string;
  from_plan: string;
  to_plan: string;
  direction: string;
  amount: number;
  credit_applied: number;
  days_remaining: number;
  note: string;
  payment_id: string | null;
  created_at: string;
};

export type ReceiptParty = {
  brandName: string;
  accountName: string | null;
  accountEmail: string | null;
};

export const receiptNumber = (row: PlanChangeRow) => {
  const d = new Date(row.created_at);
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `PLN-${ym}-${row.id.slice(0, 6).toUpperCase()}`;
};

export const receiptDate = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export type ReceiptLine = { label: string; value: string };

/** The billing breakdown shown both on screen and in the PDF. */
export function receiptLines(row: PlanChangeRow): ReceiptLine[] {
  const to = tierByKey(row.to_plan);
  const from = tierByKey(row.from_plan);
  const lines: ReceiptLine[] = [
    { label: `${to.name} plan, monthly list price`, value: money(to.amount) },
    { label: `Previous plan (${from.name}), monthly list price`, value: money(from.amount) },
    { label: "Days remaining in billing period", value: String(row.days_remaining) },
  ];
  if (Number(row.credit_applied) > 0) {
    lines.push({ label: "Unused time credit applied", value: `- ${money(row.credit_applied)}` });
  }
  return lines;
}

export function receiptTitle(row: PlanChangeRow) {
  return row.direction === "upgrade" ? "UPGRADE RECEIPT" : "PLAN CHANGE RECEIPT";
}

const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const ACCENT: [number, number, number] = [37, 99, 235];

export function buildPlanReceiptPdf(row: PlanChangeRow, party: ReceiptParty): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const m = 48;
  const right = doc.internal.pageSize.getWidth() - m;

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, "F");

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(party.brandName, m, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Subscription billing", m, 74);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(receiptTitle(row), right, 60, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`No. ${receiptNumber(row)}`, right, 74, { align: "right" });
  doc.text(receiptDate(row.created_at), right, 86, { align: "right" });

  doc.setTextColor(...INK);
  doc.setFontSize(10);
  const left = [
    `Billed to: ${party.accountName || "Account owner"}`,
    `Email: ${party.accountEmail || "-"}`,
  ];
  const meta = [
    `Change: ${tierByKey(row.from_plan).name} to ${tierByKey(row.to_plan).name}`,
    `Type: ${row.direction === "upgrade" ? "Upgrade" : "Downgrade"}`,
    row.payment_id ? `Payment ref: ${row.payment_id}` : "Payment ref: not applicable",
  ];
  left.forEach((line, i) => doc.text(line, m, 116 + i * 14));
  meta.forEach((line, i) => doc.text(line, right, 116 + i * 14, { align: "right" }));

  autoTable(doc, {
    startY: 172,
    margin: { left: m, right: m },
    head: [["Description", "Detail"]],
    body: receiptLines(row).map((l) => [l.label, l.value]),
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: INK },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], halign: "left" },
    columnStyles: { 1: { halign: "right" } },
    theme: "grid",
  });

  const after =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("Amount charged", m, after + 32);
  doc.text(money(row.amount), right, after + 32, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const note = row.note || "Plan change recorded on your account.";
  doc.text(doc.splitTextToSize(note, right - m), m, after + 54);

  doc.text(
    row.payment_id
      ? "Paid online. This receipt is computer generated and valid without a signature."
      : "No payment was collected for this change. This receipt is computer generated.",
    m,
    doc.internal.pageSize.getHeight() - 48,
  );

  return doc;
}

export function downloadPlanReceipt(row: PlanChangeRow, party: ReceiptParty) {
  buildPlanReceiptPdf(row, party).save(`${receiptNumber(row)}.pdf`);
}
