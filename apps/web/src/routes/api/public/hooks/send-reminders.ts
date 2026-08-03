import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily payment reminder run, called by the scheduled cron job.
 *
 * POST /api/public/hooks/send-reminders
 * headers: { x-cron-secret: <CRON_HOOK_SECRET> }
 * body:    {}   // optional: { "today": "2026-08-05", "dryRun": true }
 */
export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_HOOK_SECRET"];
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let today: string | undefined;
        let dryRun = false;
        try {
          const body = (await request.json()) as { today?: unknown; dryRun?: unknown };
          if (typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)) {
            today = body.today;
          }
          dryRun = body?.dryRun === true;
        } catch {
          // No body sent - use today's date.
        }

        try {
          const { runPaymentReminders } = await import("@/lib/reminders.server");
          const result = await runPaymentReminders({
            ...(today ? { today } : {}),
            dryRun,
          });
          console.info("[send-reminders] ok", {
            today: result.today,
            candidates: result.candidates,
            matched: result.matched,
            emailSent: result.emailSent,
            errors: result.errors.length,
          });
          return Response.json(result);
        } catch (error) {
          console.error("[send-reminders] failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Reminder run failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
