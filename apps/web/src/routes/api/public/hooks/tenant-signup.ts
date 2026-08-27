import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, no-login tenant self-signup. The token in the URL is the only
 * authorization - there is no session, so every write is derived from the
 * resolved link, never from client-supplied property/admin ids.
 *
 * GET  /api/public/hooks/tenant-signup?token=...  -> { propertyName, vacantRooms }
 * POST /api/public/hooks/tenant-signup            -> multipart form data with tenant fields and an optional address_proof_file
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

        const contentLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
          return Response.json(
            { error: "Address proof files must be 5 MB or smaller." },
            { status: 413 },
          );
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return Response.json({ error: "Malformed request." }, { status: 400 });
        }

        const str = (key: string) => {
          const value = formData.get(key);
          return typeof value === "string" ? value : undefined;
        };
        const token = str("token") ?? "";
        const roomId = str("roomId") ?? "";
        const full_name = str("full_name") ?? "";
        const phone = str("phone") ?? "";
        const proofValue = formData.get("address_proof_file");
        const address_proof_file = proofValue instanceof File ? proofValue : undefined;

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
            address_proof_file,
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
