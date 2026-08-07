import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay webhook. This is the authoritative confirmation path: the browser
 * callback in plan.tsx is a convenience so the page updates immediately, but it
 * is lost if the tab closes or the network drops between Razorpay capturing the
 * money and the callback firing. Without this route that payment is collected
 * and the plan never activates.
 *
 * Configure in the Razorpay dashboard against POST /api/public/hooks/razorpay
 * with the active events payment.captured, order.paid and payment.failed, and
 * put the signing secret it gives you in RAZORPAY_WEBHOOK_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Must be the raw bytes: the HMAC is over the body exactly as sent, so
        // parsing and re-serialising would change the whitespace and fail.
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        let verified: boolean;
        try {
          const { verifyRazorpayWebhook } = await import("@/lib/plan-checkout.server");
          verified = verifyRazorpayWebhook(rawBody, signature);
        } catch (error) {
          // Secret missing. A 500 makes Razorpay retry, so the payment is not
          // lost once the configuration is fixed.
          console.error("[razorpay-webhook] not configured", error);
          return Response.json({ error: "Webhook not configured" }, { status: 500 });
        }

        if (!verified) {
          console.warn("[razorpay-webhook] rejected: bad signature");
          return Response.json({ error: "Invalid signature" }, { status: 400 });
        }

        let event: string | undefined;
        let orderId: string | undefined;
        let paymentId: string | undefined;
        try {
          const body = JSON.parse(rawBody) as {
            event?: unknown;
            payload?: { payment?: { entity?: { id?: unknown; order_id?: unknown } } };
          };
          if (typeof body.event === "string") event = body.event;
          const entity = body.payload?.payment?.entity;
          if (typeof entity?.id === "string") paymentId = entity.id;
          if (typeof entity?.order_id === "string") orderId = entity.order_id;
        } catch {
          return Response.json({ error: "Malformed payload" }, { status: 400 });
        }

        // Anything else (settlements, refunds, subscription events) is
        // acknowledged so Razorpay stops retrying, but not acted on.
        const handled = event === "payment.captured" || event === "order.paid";
        if (!handled && event !== "payment.failed") {
          return Response.json({ ok: true, ignored: event ?? "unknown" });
        }

        if (!orderId || !paymentId) {
          console.warn("[razorpay-webhook] event without order/payment id", { event });
          return Response.json({ ok: true, ignored: "missing ids" });
        }

        if (event === "payment.failed") {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            // neq guards the case where a capture landed first: a later failure
            // event must not undo a successful payment.
            const { error } = await supabaseAdmin
              .from("plan_payments")
              .update({ status: "failed", provider_payment_id: paymentId })
              .eq("provider_order_id", orderId)
              .neq("status", "paid");
            if (error) throw error;
            return Response.json({ ok: true, event });
          } catch (error) {
            console.error("[razorpay-webhook] could not record failure", error);
            return Response.json({ error: "Could not record failure" }, { status: 500 });
          }
        }

        try {
          const { applyPaidPayment } = await import("@/lib/plan-apply.server");
          const result = await applyPaidPayment({ orderId, paymentId, source: "webhook" });
          console.info("[razorpay-webhook] ok", {
            event,
            orderId,
            plan: result.plan,
            applied: result.applied,
          });
          return Response.json({ ok: true, event, applied: result.applied });
        } catch (error) {
          // 500 so Razorpay retries. applyPaidPayment released its claim, so a
          // retry can still complete the activation.
          console.error("[razorpay-webhook] apply failed", { event, orderId, error });
          return Response.json(
            { error: error instanceof Error ? error.message : "Apply failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
