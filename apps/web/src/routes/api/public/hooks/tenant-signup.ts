import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, no-login tenant self-signup. The token in the URL is the only
 * authorization - there is no session, so every write is derived from the
 * resolved link, never from client-supplied property/admin ids.
 *
 * GET  /api/public/hooks/tenant-signup?token=...  -> { propertyName, vacantRooms }
 * POST /api/public/hooks/tenant-signup            -> { token, roomId, full_name, phone, ... }
 */
export const Route = createFileRoute("/api/public/hooks/tenant-signup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { resolveSignupLink, listVacantRooms } = await import("@/lib/tenant-signup.server");

        try {
          const link = await resolveSignupLink(token);
          if (!link) {
            return Response.json(
              { error: "This signup link is no longer active." },
              { status: 404 },
            );
          }
          const vacantRooms = await listVacantRooms(link.propertyId);
          return Response.json({ propertyName: link.propertyName, vacantRooms });
        } catch (error) {
          console.error("[tenant-signup] lookup failed", error);
          return Response.json({ error: "Could not load this link." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const { createSignupTenant, SignupError } = await import("@/lib/tenant-signup.server");

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Malformed request." }, { status: 400 });
        }

        const token = typeof body["token"] === "string" ? body["token"] : "";
        const roomId = typeof body["roomId"] === "string" ? body["roomId"] : "";
        const full_name = typeof body["full_name"] === "string" ? body["full_name"] : "";
        const phone = typeof body["phone"] === "string" ? body["phone"] : "";
        const str = (key: string) =>
          typeof body[key] === "string" ? (body[key] as string) : undefined;

        try {
          await createSignupTenant(token, {
            roomId,
            full_name,
            phone,
            alternate_phone: str("alternate_phone"),
            email: str("email"),
            permanent_address: str("permanent_address"),
            emergency_contact_name: str("emergency_contact_name"),
            emergency_contact_phone: str("emergency_contact_phone"),
            address_proof_type: str("address_proof_type"),
            joining_date: str("joining_date"),
          });
          return Response.json({ ok: true });
        } catch (error) {
          if (error instanceof SignupError) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          console.error("[tenant-signup] submit failed", error);
          return Response.json(
            { error: "Could not complete signup. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
