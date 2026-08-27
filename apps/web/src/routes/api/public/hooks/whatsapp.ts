import { createFileRoute } from "@tanstack/react-router";

/**
 * WhatsApp Cloud API webhook.
 *
 * GET is Meta's verification handshake, required once when you register this
 * URL in the app dashboard under WhatsApp > Configuration: it sends
 * hub.mode=subscribe with a challenge and expects that exact challenge echoed
 * back, but only if hub.verify_token matches the value you chose yourself and
 * put in WHATSAPP_VERIFY_TOKEN (Meta never generates this token for you).
 *
 * POST is the ongoing delivery of message status updates (sent/delivered/read
 * /failed) and inbound messages. Status updates are matched back to the row
 * `sendTenantWhatsApp` (see whatsapp.server.ts) logged by provider_message_id
 * and used to keep notification_logs current. Inbound messages are logged
 * only — there is no reply flow yet.
 *
 * Deliberately not verifying X-Hub-Signature-256 on the POST body: that's
 * keyed by the Meta app secret, which nothing in this codebase collects today.
 * Add it if WHATSAPP_APP_SECRET is ever introduced; until then this matches
 * the minimum Meta itself requires.
 */
export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let result: { ok: true; challenge: string } | { ok: false };
        try {
          const { verifyWhatsAppChallenge } = await import("@/lib/whatsapp-webhook.server");
          result = verifyWhatsAppChallenge({
            mode: url.searchParams.get("hub.mode"),
            token: url.searchParams.get("hub.verify_token"),
            challenge: url.searchParams.get("hub.challenge"),
          });
        } catch (error) {
          console.error("[whatsapp-webhook] not configured", error);
          return new Response("Webhook not configured", { status: 500 });
        }

        if (!result.ok) {
          console.warn("[whatsapp-webhook] verification rejected");
          return new Response("Forbidden", { status: 403 });
        }
        return new Response(result.challenge, { status: 200 });
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch (error) {
          console.warn("[whatsapp-webhook] malformed payload", error);
          return Response.json({ error: "Malformed payload" }, { status: 400 });
        }

        const { parseWhatsAppWebhookPayload, applyWhatsAppStatusUpdates } =
          await import("@/lib/whatsapp-webhook.server");
        const { statuses, messages } = parseWhatsAppWebhookPayload(body);

        if (messages.length > 0) {
          // No reply flow exists yet - acknowledged and logged only.
          console.info("[whatsapp-webhook] inbound message(s)", messages);
        }

        if (statuses.length > 0) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await applyWhatsAppStatusUpdates(supabaseAdmin, statuses);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
