import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildBillEmailHtml, buildBillEmailSubject, sendTenantEmail } from "@/lib/email.server";

export type ChannelResult = { sent: boolean; reason?: string };
export type BillNotifyResult = { email: ChannelResult };

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Best-effort notification for one bill on both channels.
 *
 * Never throws: a failing channel is reported back so the caller can surface it
 * without rolling back the billing change that triggered it.
 */
export async function notifyTenantAboutBill(
  supabase: SupabaseClient<Database>,
  billId: string,
  options: { updated: boolean },
): Promise<BillNotifyResult> {
  const result: BillNotifyResult = {
    email: { sent: false, reason: "Not attempted" },
  };

  const { data: bill, error } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .maybeSingle();
  if (error || !bill) {
    const reason = error?.message ?? "Bill not found";
    return { email: { sent: false, reason } };
  }

  const [tenantRes, propertyRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, full_name, email, room_id")
      .eq("id", bill.tenant_id)
      .maybeSingle(),
    supabase.from("properties").select("name").eq("id", bill.property_id).maybeSingle(),
  ]);
  const tenant = tenantRes.data;
  if (!tenant) {
    return { email: { sent: false, reason: "Tenant not found" } };
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("room_number")
    .eq("id", tenant.room_id)
    .maybeSingle();

  const label = monthLabel(bill.bill_month);
  const propertyName = propertyRes.data?.name ?? "your PG";
  const roomNumber = room?.room_number ?? "-";
  const messageType = "bill-generated" as const;



  // Email
  if (!tenant.email) {
    result.email = { sent: false, reason: "Tenant has no email address on file." };
  } else {
    const data = {
      tenantName: tenant.full_name,
      propertyName,
      roomNumber,
      monthLabel: label,
      totalAmount: Number(bill.total_amount),
      paidAmount: Number(bill.paid_amount),
      rentAmount: Number(bill.rent_amount),
      electricityAmount: Number(bill.electricity_amount),
      electricityUnits: Number(bill.electricity_units_consumed ?? 0),
      dueDate: bill.due_date,
      updated: options.updated,
    };
    result.email = await sendTenantEmail(supabase, {
      tenantId: tenant.id,
      billId: bill.id,
      to: tenant.email,
      subject: buildBillEmailSubject(data),
      html: buildBillEmailHtml(data),
      messageType,
    });
  }

  return result;
}
