import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { constantTimeEqual } from "@/lib/plan-checkout.server";

/**
 * WhatsApp Cloud API webhook logic, split out of the route file so it can be
 * unit tested directly (the route handlers themselves aren't easily invoked
 * from a test - see razorpay-webhook.test.ts for the same split).
 */

export type WhatsAppStatusUpdate = {
  id: string;
  status: Database["public"]["Enums"]["notification_status"];
};

export type WhatsAppInboundMessage = {
  id: string;
  from: string;
  type: string;
};

const KNOWN_STATUSES = new Set<Database["public"]["Enums"]["notification_status"]>([
  "sent",
  "delivered",
  "read",
  "failed",
]);

/**
 * Verifies Meta's one-time subscription handshake (GET hub.mode=subscribe).
 *
 * Throws when WHATSAPP_VERIFY_TOKEN is not configured, so the route can
 * answer 500 rather than a misleading 403 - the same "not configured vs.
 * rejected" split verifyRazorpayWebhook makes.
 */
export function verifyWhatsAppChallenge(input: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}): { ok: true; challenge: string } | { ok: false } {
  const expected = process.env["WHATSAPP_VERIFY_TOKEN"];
  if (!expected) throw new Error("WHATSAPP_VERIFY_TOKEN is not configured");
  if (input.mode !== "subscribe" || !input.challenge) return { ok: false };
  if (!constantTimeEqual(expected, input.token)) return { ok: false };
  return { ok: true, challenge: input.challenge };
}

/**
 * Extracts status updates and inbound messages from a webhook delivery body.
 * Defensive about shape: Meta's payload is deeply nested and any level can be
 * missing, and an unrecognised status value is dropped rather than written,
 * since notification_status is a fixed enum.
 */
export function parseWhatsAppWebhookPayload(body: unknown): {
  statuses: WhatsAppStatusUpdate[];
  messages: WhatsAppInboundMessage[];
} {
  const statuses: WhatsAppStatusUpdate[] = [];
  const messages: WhatsAppInboundMessage[] = [];

  const entries = isRecord(body) && Array.isArray(body["entry"]) ? body["entry"] : [];
  for (const entry of entries) {
    const changes = isRecord(entry) && Array.isArray(entry["changes"]) ? entry["changes"] : [];
    for (const change of changes) {
      const value = isRecord(change) ? change["value"] : undefined;
      if (!isRecord(value)) continue;

      const rawStatuses = Array.isArray(value["statuses"]) ? value["statuses"] : [];
      for (const s of rawStatuses) {
        if (!isRecord(s)) continue;
        const id = s["id"];
        const status = s["status"];
        if (
          typeof id === "string" &&
          typeof status === "string" &&
          KNOWN_STATUSES.has(status as Database["public"]["Enums"]["notification_status"])
        ) {
          statuses.push({ id, status: status as Database["public"]["Enums"]["notification_status"] });
        }
      }

      const rawMessages = Array.isArray(value["messages"]) ? value["messages"] : [];
      for (const m of rawMessages) {
        if (!isRecord(m)) continue;
        const id = m["id"];
        if (typeof id !== "string") continue;
        messages.push({
          id,
          from: typeof m["from"] === "string" ? m["from"] : "unknown",
          type: typeof m["type"] === "string" ? m["type"] : "unknown",
        });
      }
    }
  }

  return { statuses, messages };
}

/**
 * Applies delivery/read/failed status updates to the notification_logs rows
 * sendTenantWhatsApp (whatsapp.server.ts) logged, matched by
 * provider_message_id.
 *
 * One row failing to update must not stop the rest, and must not throw back
 * to the route - Meta needs a 200 regardless or it retries the whole payload.
 */
export async function applyWhatsAppStatusUpdates(
  supabase: SupabaseClient<Database>,
  statuses: WhatsAppStatusUpdate[],
): Promise<void> {
  for (const s of statuses) {
    try {
      const { error } = await supabase
        .from("notification_logs")
        .update({ status: s.status })
        .eq("provider_message_id", s.id);
      if (error) throw error;
    } catch (error) {
      console.error("[whatsapp-webhook] status update failed", { id: s.id, error });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
