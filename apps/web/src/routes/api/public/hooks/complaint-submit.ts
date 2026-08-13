import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, no-login complaint submission. Same trust model as tenant-signup:
 * the token in the URL is the only authorization, and property/admin ids are
 * always derived from the resolved link, never from the client.
 *
 * GET  /api/public/hooks/complaint-submit?token=...  -> { propertyName }
 * POST /api/public/hooks/complaint-submit            -> { token, tenant_name, room_number, phone, email?, note }
 */
export const Route = createFileRoute("/api/public/hooks/complaint-submit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { resolveComplaintLink } = await import("@/lib/complaint-submit.server");

        try {
          const link = await resolveComplaintLink(token);
          if (!link) {
            return Response.json(
              { error: "This complaint link is no longer active." },
              { status: 404 },
            );
          }
          return Response.json({ propertyName: link.propertyName });
        } catch (error) {
          console.error("[complaint-submit] lookup failed", error);
          return Response.json({ error: "Could not load this link." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const { createComplaint, ComplaintError } = await import("@/lib/complaint-submit.server");

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Malformed request." }, { status: 400 });
        }

        const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
        const token = str("token");

        try {
          await createComplaint(token, {
            tenant_name: str("tenant_name"),
            room_number: str("room_number"),
            phone: str("phone"),
            email: str("email") || undefined,
            note: str("note"),
          });
          return Response.json({ ok: true });
        } catch (error) {
          if (error instanceof ComplaintError) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          console.error("[complaint-submit] submit failed", error);
          return Response.json(
            { error: "Could not submit your complaint. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
