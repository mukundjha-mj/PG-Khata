import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildBillEmailHtml, buildBillEmailSubject, sendTenantEmail } from "@/lib/email.server";
import { formatDate, formatMoneyBare } from "@/lib/pg";
import {
  computeElectricitySplit,
  formatElectricityUnits,
  type ElectricitySplit,
} from "@/lib/electricity-split";
import { isWhatsAppConfigured, sendTenantWhatsApp } from "@/lib/whatsapp.server";
import { checkWhatsAppQuota } from "@/lib/whatsapp-quota.server";

export type ChannelResult = { sent: boolean; reason?: string };
export type BillNotifyResult = { email: ChannelResult; whatsapp: ChannelResult };

/** Template name that must be approved in the Meta Business account. */
export const BILL_TEMPLATE_NAME = "monthly_bill_ready";

/**
 * Maps a bill onto monthly_bill_ready's named body variables.
 *
 * Meta rejects free-form text for business-initiated messages outside a
 * 24-hour window, so wording lives in the approved template and only these
 * substitutions vary. Names must match the template exactly - see
 * apps/web/whatsapp-bill-template-plan.md for the approved body text.
 */
function buildBillWhatsAppTemplate(data: {
  tenantName: string;
  monthLabel: string;
  propertyName: string;
  roomNumber: string;
  rentAmount: number;
  electricityAmount: number;
  electricityUnits: number;
  electricitySplit: ElectricitySplit | null;
  otherChargesTotal: number;
  totalAmount: number;
  dueDate: string | null;
  upiVpa: string | null;
}) {
  return {
    name: BILL_TEMPLATE_NAME,
    languageCode: "en",
    headerImageUrl: `${process.env["VITE_APP_URL"] || "https://app.pgkhata.com"}/whatsapp-bill-header.png`,
    namedParameters: {
      tenant_name: data.tenantName,
      bill_month: data.monthLabel,
      property_room: `${data.propertyName} Room ${data.roomNumber}`,
      rent_amount: formatMoneyBare(data.rentAmount),
      electricity_amount: `${formatMoneyBare(data.electricityAmount)} (${formatElectricityUnits(data.electricityUnits, data.electricitySplit)})`,
      other_charges: data.otherChargesTotal > 0 ? formatMoneyBare(data.otherChargesTotal) : "—",
      total_amount: formatMoneyBare(data.totalAmount),
      due_date: data.dueDate ? formatDate(data.dueDate) : "as soon as possible",
      upi_id: data.upiVpa ?? "—",
    },
  };
}

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
  options: {
    updated: boolean;
    /** Which channels to attempt. Omitted/undefined means both, for backward compatibility. */
    channels?: { email: boolean; whatsapp: boolean } | undefined;
  },
): Promise<BillNotifyResult> {
  const emailWanted = options.channels?.email ?? true;
  const whatsappWanted = options.channels?.whatsapp ?? true;
  const result: BillNotifyResult = {
    email: { sent: false, reason: "Not attempted" },
    whatsapp: { sent: false, reason: "Not attempted" },
  };

  const { data: bill, error } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .maybeSingle();
  if (error || !bill) {
    const reason = error?.message ?? "Bill not found";
    return {
      email: { sent: false, reason },
      whatsapp: { sent: false, reason },
    };
  }

  const [tenantRes, propertyRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, full_name, email, phone, room_id")
      .eq("id", bill.tenant_id)
      .maybeSingle(),
    supabase.from("properties").select("name, admin_id").eq("id", bill.property_id).maybeSingle(),
  ]);
  const tenant = tenantRes.data;
  if (!tenant) {
    const reason = "Tenant not found";
    return {
      email: { sent: false, reason },
      whatsapp: { sent: false, reason },
    };
  }

  const [roomRes, settingsRes, roommatesRes] = await Promise.all([
    supabase.from("rooms").select("room_number").eq("id", tenant.room_id).maybeSingle(),
    propertyRes.data?.admin_id
      ? supabase
          .from("settings")
          .select("upi_vpa, whatsapp_enabled, whatsapp_country_code")
          .eq("admin_id", propertyRes.data.admin_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("tenants").select("id").eq("room_id", tenant.room_id),
  ]);

  // Sibling bills for the same room + month, to show a tenant how their
  // electricity share was actually derived - not a re-billing, just showing
  // the math behind an amount already charged.
  const roommateIds = (roommatesRes.data ?? []).map((t) => t.id);
  const { data: siblingBills } = await supabase
    .from("bills")
    .select("electricity_units_consumed")
    .in("tenant_id", roommateIds)
    .eq("bill_month", bill.bill_month);
  const electricitySplit =
    siblingBills && siblingBills.length > 0
      ? computeElectricitySplit(siblingBills.map((b) => b.electricity_units_consumed))
      : null;

  const label = monthLabel(bill.bill_month);
  const propertyName = propertyRes.data?.name ?? "your PG";
  const roomNumber = roomRes.data?.room_number ?? "-";
  const otherChargesTotal = Array.isArray(bill.other_charges)
    ? (bill.other_charges as Array<{ amount?: number }>).reduce(
        (sum, item) => sum + Number(item?.amount ?? 0),
        0,
      )
    : 0;
  const messageType = "bill-generated" as const;

  // Email
  if (!emailWanted) {
    result.email = { sent: false, reason: "Email not selected." };
  } else if (!tenant.email) {
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
      electricitySplit,
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

  // WhatsApp
  const adminId = propertyRes.data?.admin_id;
  if (!whatsappWanted) {
    result.whatsapp = { sent: false, reason: "WhatsApp not selected." };
  } else if (!settingsRes.data?.whatsapp_enabled || !isWhatsAppConfigured()) {
    result.whatsapp = { sent: false, reason: "WhatsApp is not enabled for this owner." };
  } else if (!tenant.phone) {
    result.whatsapp = { sent: false, reason: "Tenant has no phone number on file." };
  } else if (!adminId) {
    result.whatsapp = { sent: false, reason: "Property owner not found." };
  } else {
    const quota = await checkWhatsAppQuota(supabase, adminId);
    if (!quota.allowed) {
      result.whatsapp = { sent: false, reason: quota.reason };
    } else {
      result.whatsapp = await sendTenantWhatsApp(supabase, {
        tenantId: tenant.id,
        adminId,
        billId: bill.id,
        phone: tenant.phone,
        dialCode: settingsRes.data.whatsapp_country_code ?? "91",
        template: buildBillWhatsAppTemplate({
          tenantName: tenant.full_name,
          monthLabel: label,
          propertyName,
          roomNumber,
          rentAmount: Number(bill.rent_amount),
          electricityAmount: Number(bill.electricity_amount),
          electricityUnits: Number(bill.electricity_units_consumed ?? 0),
          electricitySplit,
          otherChargesTotal,
          totalAmount: Number(bill.total_amount),
          dueDate: bill.due_date,
          upiVpa: settingsRes.data.upi_vpa,
        }),
        messageType,
      });
    }
  }

  return result;
}
