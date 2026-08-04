import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Email is configured entirely through the environment. A hosting dashboard
 * hands back "" for a variable that was added but never filled, so blank has
 * to be treated as unset — otherwise an empty From reaches Resend and every
 * bill and reminder fails, one tenant at a time, with nothing in the UI.
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

function args() {
  return {
    tenantId: "ten-1",
    billId: "bill-1",
    to: "asha@example.com",
    subject: "Your March bill",
    html: "<p>hi</p>",
    messageType: "bill" as const,
  };
}

async function send() {
  const { sendTenantEmail } = await import("@/lib/email.server");
  return sendTenantEmail(supabase, args());
}

beforeEach(() => {
  logged = [];
  vi.resetModules();
  process.env["RESEND_API_KEY"] = "re_test_key";
  process.env["RESEND_FROM_EMAIL"] = "PGKhata <no-reply@pgkhata.com>";
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ id: "resend-1" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("sendTenantEmail configuration", () => {
  it("sends From the configured address, with nothing hardcoded", async () => {
    process.env["RESEND_FROM_EMAIL"] = "Someone <billing@example.org>";
    const result = await send();

    expect(result.sent).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.from).toBe("Someone <billing@example.org>");
  });

  it("does not send when the From address is blank", async () => {
    process.env["RESEND_FROM_EMAIL"] = "";
    const result = await send();

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send when the From address is whitespace", async () => {
    process.env["RESEND_FROM_EMAIL"] = "   ";
    const result = await send();

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send when the API key is blank", async () => {
    process.env["RESEND_API_KEY"] = "";
    const result = await send();

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the failure rather than throwing, so one bad address does not abort a batch", async () => {
    process.env["RESEND_FROM_EMAIL"] = "";
    const result = await send();

    expect(result.reason).toBeTruthy();
  });
});
