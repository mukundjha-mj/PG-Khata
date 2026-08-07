import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly subscription lifecycle sweep, called by the scheduled cron job.
 * Marks accounts past_due once their payment buffer is fully spent. Safe to
 * call repeatedly: accounts already past_due are skipped.
 *
 * POST /api/public/hooks/plan-lifecycle
 * headers: { x-cron-secret: <CRON_HOOK_SECRET> }
 * body:    {}   // optional: { "today": "2026-08-18", "dryRun": true }
 */
export const Route = createFileRoute("/api/public/hooks/plan-lifecycle")({
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
          // No body sent - sweep as of today.
        }

        try {
          const { runPlanLifecycle } = await import("@/lib/plan-lifecycle.server");
          const result = await runPlanLifecycle({
            ...(today ? { today } : {}),
            dryRun,
          });
          console.info("[plan-lifecycle] ok", {
            today: result.today,
            scanned: result.scanned,
            lapsed: result.lapsed,
            updated: result.updated,
            errors: result.errors.length,
          });
          return Response.json(result);
        } catch (error) {
          console.error("[plan-lifecycle] failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Lifecycle run failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
