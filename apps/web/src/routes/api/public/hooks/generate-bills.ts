import { createFileRoute } from "@tanstack/react-router";

/**
 * Monthly billing run, called by the scheduled cron job (and manually from
 * Billing → "Run monthly billing"). Safe to call repeatedly: tenants already
 * billed for the month are skipped.
 *
 * POST /api/public/hooks/generate-bills
 * headers: { x-cron-secret: <CRON_HOOK_SECRET> }
 * body:    { "month": "2026-08" }   // optional, defaults to the current month
 */
export const Route = createFileRoute("/api/public/hooks/generate-bills")({
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

        const { runMonthlyBilling, currentMonth, isValidMonth } =
          await import("@/lib/billing-run.server");

        let month = currentMonth();
        try {
          const body = (await request.json()) as { month?: unknown };
          if (body?.month !== undefined) {
            if (!isValidMonth(body.month)) {
              return Response.json({ error: "month must look like 2026-08" }, { status: 400 });
            }
            month = body.month;
          }
        } catch {
          // No body sent - bill the current month.
        }

        try {
          // Scheduled bills land unapproved so an admin reviews them first.
          const result = await runMonthlyBilling(month, { approved: false });
          console.info("[generate-bills] ok", {
            month,
            admins: result.admins,
            created: result.created,
            skipped: result.skipped,
            errors: result.errors.length,
          });
          return Response.json(result);
        } catch (error) {
          console.error("[generate-bills] failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Billing run failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
