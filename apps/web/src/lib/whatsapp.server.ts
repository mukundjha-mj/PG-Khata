import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalisePhone } from "@/lib/phone";

/**
 * WhatsApp delivery through the official Meta Cloud API.
 *
 * Deliberately NOT a self-hosted bridge driving a personal WhatsApp account:
 * that breaks WhatsApp's terms and gets the number banned, taking every tenant
 * conversation with it.
 *
 * Credentials come from the environment, never from a database row — a token in
 * a table is one careless SELECT away from letting somebody message every
 * tenant on the platform.
 */

const GRAPH_VERSION = "v21.0";

export type WhatsAppTemplate = {
  /** Template name as approved in the Meta Business account. */
  name: string;
  languageCode: string;
  /**
   * Ordered body substitutions, matching {{1}}, {{2}} ... in the template.
   * Mutually exclusive with `namedParameters` - a template is approved with
   * one style of variable or the other, never both.
   */
  bodyParameters?: string[];
  /** Named substitutions, matching {{tenant_name}}, {{bill_month}} ... */
  namedParameters?: Record<string, string>;
  /** Absolute HTTPS URL for the template's IMAGE header component, if any. */
  headerImageUrl?: string;
};

function credentials() {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

export function isWhatsAppConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Sends one templated WhatsApp message and logs the attempt.
 *
 * Returns a reason rather than throwing, so one unreachable tenant never aborts
 * a reminder run for everyone else — matching sendTenantEmail.
 *
 * Business-initiated messages outside a 24-hour customer service window must
 * use a pre-approved template; free-form text is rejected by Meta. Reminders
 * are always business-initiated, so this only sends templates.
 */
export async function sendTenantWhatsApp(
  supabase: SupabaseClient<Database>,
  args: {
    tenantId: string;
    adminId: string;
    billId?: string | null;
    phone: string;
    dialCode?: string;
    template: WhatsAppTemplate;
    messageType: Database["public"]["Enums"]["message_type"];
  },
): Promise<{ sent: boolean; reason?: string }> {
  const creds = credentials();
  if (!creds) return { sent: false, reason: "WhatsApp is not connected yet." };

  const to = normalisePhone(args.phone, args.dialCode ?? "91");
  if (!to) {
    // The Cloud API accepts a malformed number and silently delivers nothing,
    // so an unusable number is recorded as a failure rather than sent blind.
    const reason = `WhatsApp: unusable phone number "${args.phone}"`;
    await logAttempt(supabase, args, { error: reason, providerId: null });
    return { sent: false, reason };
  }

  let errorMessage: string | null = null;
  let providerId: string | null = null;

  try {
    const { headerImageUrl, namedParameters, bodyParameters } = args.template;
    const components: Record<string, unknown>[] = [];
    if (headerImageUrl) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: headerImageUrl } }],
      });
    }
    if (namedParameters) {
      components.push({
        type: "body",
        parameters: Object.entries(namedParameters).map(([name, text]) => ({
          type: "text",
          parameter_name: name,
          text,
        })),
      });
    } else if (bodyParameters) {
      components.push({
        type: "body",
        parameters: bodyParameters.map((text) => ({ type: "text", text })),
      });
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: args.template.name,
            language: { code: args.template.languageCode },
            components,
          },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      errorMessage = `WhatsApp provider failed [${res.status}]: ${body.slice(0, 300)}`;
    } else {
      const body = (await res.json()) as { messages?: Array<{ id?: string }> };
      providerId = body.messages?.[0]?.id ?? null;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "WhatsApp request failed";
  }

  await logAttempt(supabase, args, { error: errorMessage, providerId });
  return errorMessage ? { sent: false, reason: errorMessage } : { sent: true };
}

async function logAttempt(
  supabase: SupabaseClient<Database>,
  args: {
    tenantId: string;
    adminId: string;
    billId?: string | null;
    messageType: Database["public"]["Enums"]["message_type"];
  },
  outcome: { error: string | null; providerId: string | null },
) {
  await supabase.from("notification_logs").insert({
    tenant_id: args.tenantId,
    admin_id: args.adminId,
    bill_id: args.billId ?? null,
    channel: "whatsapp",
    message_type: args.messageType,
    status: outcome.error ? "failed" : "sent",
    provider_message_id: outcome.providerId,
    error_message: outcome.error,
  });
}
