import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BROADCAST_SEGMENTS, type BroadcastSegment } from "@/lib/broadcast.server";

function parseSegment(value: unknown): BroadcastSegment {
  const segment = String(value ?? "");
  if (!(BROADCAST_SEGMENTS as readonly string[]).includes(segment)) {
    throw new Error("Unknown broadcast segment");
  }
  return segment as BroadcastSegment;
}

/** Recipient count for a segment, before committing to a send. Platform team only. */
export const previewBroadcastSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { segment: string }) => ({ segment: parseSegment(input.segment) }))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/platform-auth.server");
    const { resolveSegmentRecipients } = await import("@/lib/broadcast.server");
    const { db } = await assertPlatformAdmin(context as never);
    const recipients = await resolveSegmentRecipients(db, data.segment);
    return { recipientCount: recipients.length };
  });

/** Sends an announcement email to every owner in a segment. Platform team only. */
export const sendBroadcastMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { segment: string; subject: string; body: string }) => {
    const subject = String(input.subject ?? "").trim();
    const body = String(input.body ?? "").trim();
    if (!subject || subject.length > 200) throw new Error("Subject must be 1-200 characters");
    if (!body || body.length > 5000) throw new Error("Message must be 1-5000 characters");
    return { segment: parseSegment(input.segment), subject, body };
  })
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin, logAction } = await import("@/lib/platform-auth.server");
    const { sendBroadcast } = await import("@/lib/broadcast.server");
    const { db, email } = await assertPlatformAdmin(context as never);
    const result = await sendBroadcast(db, data);
    await logAction(db, {
      actorId: context.userId,
      actorEmail: email,
      action: "send_broadcast",
      targetLabel: data.segment,
      details: {
        segment: data.segment,
        subject: data.subject,
        recipientCount: result.recipientCount,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      },
    });
    return result;
  });
