import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyWhatsAppStatusUpdates,
  parseWhatsAppWebhookPayload,
  verifyWhatsAppChallenge,
} from "@/lib/whatsapp-webhook.server";

/**
 * WhatsApp Cloud API webhook.
 *
 * Mirrors razorpay-webhook.test.ts: the route file is a thin handler, the
 * logic worth pinning lives in whatsapp-webhook.server.ts.
 */

const TOKEN = "verify_test_5f3a91";

describe("verifyWhatsAppChallenge", () => {
  const original = process.env["WHATSAPP_VERIFY_TOKEN"];

  beforeEach(() => {
    process.env["WHATSAPP_VERIFY_TOKEN"] = TOKEN;
  });

  afterEach(() => {
    if (original === undefined) delete process.env["WHATSAPP_VERIFY_TOKEN"];
    else process.env["WHATSAPP_VERIFY_TOKEN"] = original;
  });

  it("echoes the challenge when mode and token match", () => {
    const result = verifyWhatsAppChallenge({
      mode: "subscribe",
      token: TOKEN,
      challenge: "123456",
    });
    expect(result).toEqual({ ok: true, challenge: "123456" });
  });

  it("rejects a wrong token", () => {
    const result = verifyWhatsAppChallenge({
      mode: "subscribe",
      token: "wrong",
      challenge: "123456",
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects a missing token without throwing on the length mismatch", () => {
    const result = verifyWhatsAppChallenge({
      mode: "subscribe",
      token: null,
      challenge: "123456",
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects a mode other than subscribe", () => {
    const result = verifyWhatsAppChallenge({
      mode: "unsubscribe",
      token: TOKEN,
      challenge: "123456",
    });
    expect(result).toEqual({ ok: false });
  });

  it("rejects a missing challenge", () => {
    const result = verifyWhatsAppChallenge({ mode: "subscribe", token: TOKEN, challenge: null });
    expect(result).toEqual({ ok: false });
  });

  it("throws when no verify token is configured, so the route can answer 500", () => {
    delete process.env["WHATSAPP_VERIFY_TOKEN"];
    expect(() =>
      verifyWhatsAppChallenge({ mode: "subscribe", token: TOKEN, challenge: "123456" }),
    ).toThrow(/WHATSAPP_VERIFY_TOKEN/);
  });
});

describe("parseWhatsAppWebhookPayload", () => {
  it("extracts status updates from a delivery payload", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: "wamid.AAA", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    const { statuses, messages } = parseWhatsAppWebhookPayload(body);
    expect(statuses).toEqual([{ id: "wamid.AAA", status: "delivered" }]);
    expect(messages).toEqual([]);
  });

  it("extracts inbound messages from a payload", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: "wamid.BBB", from: "919876543210", type: "text" }],
              },
            },
          ],
        },
      ],
    };
    const { statuses, messages } = parseWhatsAppWebhookPayload(body);
    expect(statuses).toEqual([]);
    expect(messages).toEqual([{ id: "wamid.BBB", from: "919876543210", type: "text" }]);
  });

  it("drops a status value outside the known notification_status enum", () => {
    const body = {
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.CCC", status: "queued" }] } }] }],
    };
    expect(parseWhatsAppWebhookPayload(body).statuses).toEqual([]);
  });

  it("handles missing entry/changes/value without throwing", () => {
    expect(parseWhatsAppWebhookPayload({})).toEqual({ statuses: [], messages: [] });
    expect(parseWhatsAppWebhookPayload(null)).toEqual({ statuses: [], messages: [] });
    expect(parseWhatsAppWebhookPayload({ entry: [{}] })).toEqual({ statuses: [], messages: [] });
  });
});

describe("applyWhatsAppStatusUpdates", () => {
  it("updates the notification_logs row matching the provider_message_id", async () => {
    const updates: Array<{ status: string }> = [];
    const eqCalls: Array<[string, string]> = [];
    const supabase = {
      from: () => ({
        update: (row: { status: string }) => {
          updates.push(row);
          return {
            eq: (col: string, val: string) => {
              eqCalls.push([col, val]);
              return Promise.resolve({ error: null });
            },
          };
        },
      }),
    } as never;

    await applyWhatsAppStatusUpdates(supabase, [{ id: "wamid.AAA", status: "delivered" }]);

    expect(updates).toEqual([{ status: "delivered" }]);
    expect(eqCalls).toEqual([["provider_message_id", "wamid.AAA"]]);
  });

  it("keeps applying the rest of the batch when one update fails", async () => {
    const attempted: string[] = [];
    const supabase = {
      from: () => ({
        update: () => ({
          eq: (_col: string, val: string) => {
            attempted.push(val);
            return Promise.resolve(
              val === "wamid.BAD" ? { error: new Error("db down") } : { error: null },
            );
          },
        }),
      }),
    } as never;

    await expect(
      applyWhatsAppStatusUpdates(supabase, [
        { id: "wamid.BAD", status: "failed" },
        { id: "wamid.OK", status: "delivered" },
      ]),
    ).resolves.toBeUndefined();

    expect(attempted).toEqual(["wamid.BAD", "wamid.OK"]);
  });
});
