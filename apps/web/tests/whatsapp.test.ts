import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildReminderTemplate, type ReminderData } from "@/lib/reminder-message";

/**
 * WhatsApp delivery through the Meta Cloud API.
 *
 * The Cloud API validates the *count* of template parameters, not their
 * meaning, so a reordering here would silently send the room number where the
 * amount belongs. These tests pin the order.
 */

let logged: Array<Record<string, unknown>>;
let fetchMock: ReturnType<typeof vi.fn>;

const supabase = {
  from: () => ({
    insert: (row: Record<string, unknown>) => {
      logged.push(row);
      return Promise.resolve({ error: null });
    },
  }),
} as never;

const reminder: ReminderData = {
  tenantName: "Asha",
  propertyName: "Sunrise PG",
  roomNumber: "12",
  monthLabel: "March 2026",
  balance: 8450,
  dueDate: "2026-03-05",
  kind: "before-due",
  daysOverdue: 0,
};

function args(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "ten-1",
    billId: "bill-1",
    phone: "9876543210",
    template: buildReminderTemplate(reminder),
    messageType: "payment-reminder" as const,
    ...overrides,
  };
}

beforeEach(() => {
  logged = [];
  vi.resetModules();
  process.env["WHATSAPP_ACCESS_TOKEN"] = "test-token";
  process.env["WHATSAPP_PHONE_NUMBER_ID"] = "12345";
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ messages: [{ id: "wamid.TEST" }] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("buildReminderTemplate", () => {
  it("maps named parameters to match the approved template", () => {
    // Template: "Hi {{tenant_name}}, your rent for {{month}} at
    // {{property_room}} is {{amount}}. Due: {{due_date}}."
    const t = buildReminderTemplate(reminder);
    expect(t.namedParameters.tenant_name).toBe("Asha");
    expect(t.namedParameters.month).toBe("March 2026");
    expect(t.namedParameters.property_room).toBe("Sunrise PG Room 12");
    expect(t.namedParameters.amount).toContain("8,450");
    expect(t.namedParameters.due_date).toContain("2026");
    expect(Object.keys(t.namedParameters)).toHaveLength(5);
  });

  it("substitutes wording when a bill has no due date", () => {
    const t = buildReminderTemplate({ ...reminder, dueDate: null });
    // An empty parameter is rejected by Meta, so the slot always carries text.
    expect(t.namedParameters.due_date).toBe("as soon as possible");
  });
});

describe("sendTenantWhatsApp", () => {
  it("posts a template message to the Cloud API and logs it", async () => {
    const { sendTenantWhatsApp } = await import("@/lib/whatsapp.server");
    const result = await sendTenantWhatsApp(supabase, args());

    expect(result.sent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toContain("graph.facebook.com");
    expect(url).toContain("/12345/messages");

    const body = JSON.parse(init.body);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.type).toBe("template");
    // Normalised to E.164 digits: the API accepts a bad number and delivers
    // nothing rather than erroring.
    expect(body.to).toBe("919876543210");
    expect(body.template.name).toBe("rent_payment_reminder");
    expect(body.template.components[0].parameters).toHaveLength(5);

    expect(logged[0]).toMatchObject({
      channel: "whatsapp",
      status: "sent",
      provider_message_id: "wamid.TEST",
      tenant_id: "ten-1",
      bill_id: "bill-1",
    });
  });

  it("records a failure without calling the API when the phone is unusable", async () => {
    const { sendTenantWhatsApp } = await import("@/lib/whatsapp.server");
    const result = await sendTenantWhatsApp(supabase, args({ phone: "12345" }));

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    // Recorded rather than dropped, so the owner can see why nothing arrived.
    expect(logged[0]).toMatchObject({ channel: "whatsapp", status: "failed" });
  });

  it("returns a reason instead of throwing when the provider rejects", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad template" });
    const { sendTenantWhatsApp } = await import("@/lib/whatsapp.server");

    const result = await sendTenantWhatsApp(supabase, args());

    // One unreachable tenant must not abort the run for everyone else.
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("400");
    expect(logged[0]).toMatchObject({ status: "failed" });
  });

  it("returns a reason instead of throwing when the request itself fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const { sendTenantWhatsApp } = await import("@/lib/whatsapp.server");

    const result = await sendTenantWhatsApp(supabase, args());

    expect(result.sent).toBe(false);
    expect(result.reason).toContain("network down");
  });

  it("does nothing when credentials are absent", async () => {
    delete process.env["WHATSAPP_ACCESS_TOKEN"];
    const { sendTenantWhatsApp, isWhatsAppConfigured } = await import("@/lib/whatsapp.server");

    expect(isWhatsAppConfigured()).toBe(false);
    const result = await sendTenantWhatsApp(supabase, args());

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    // Not configured is not a delivery failure, so nothing is logged.
    expect(logged).toHaveLength(0);
  });

  it("never puts the access token in the request body", async () => {
    const { sendTenantWhatsApp } = await import("@/lib/whatsapp.server");
    await sendTenantWhatsApp(supabase, args());

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string; headers: Headers }];
    expect(init.body).not.toContain("test-token");
    expect(JSON.stringify(logged)).not.toContain("test-token");
  });
});
