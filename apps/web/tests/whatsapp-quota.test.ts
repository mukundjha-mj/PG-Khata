import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkWhatsAppQuota, getWhatsAppQuotaStatus } from "@/lib/whatsapp-quota.server";

type Settings = { whatsapp_monthly_limit: number; whatsapp_unlimited: boolean };

function quotaClient(settings: Settings, sentCount: number) {
  const windowStarts: string[] = [];
  const countedStatuses: string[][] = [];
  const client = {
    from(table: string) {
      if (table === "settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: settings, error: null }),
            }),
          }),
        };
      }

      if (table === "notification_logs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: (_column: string, statuses: string[]) => ({
                  gte: (_gteColumn: string, value: string) => {
                    countedStatuses.push(statuses);
                    windowStarts.push(value);
                    return Promise.resolve({ count: sentCount, error: null });
                  },
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;

  return { client, windowStarts, countedStatuses };
}

afterEach(() => vi.useRealTimers());

describe("WhatsApp monthly quota", () => {
  it("returns remaining messages from this month's sent notification count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T15:30:00.000Z"));
    const { client, windowStarts, countedStatuses } = quotaClient(
      { whatsapp_monthly_limit: 50, whatsapp_unlimited: false },
      17,
    );

    await expect(getWhatsAppQuotaStatus(client, "owner-1")).resolves.toEqual({
      used: 17,
      limit: 50,
      remaining: 33,
    });
    expect(windowStarts).toEqual(["2026-08-01T00:00:00.000Z"]);
    expect(countedStatuses).toEqual([["sent", "delivered", "read"]]);
  });

  it("reports unlimited owners without imposing a numeric limit", async () => {
    const { client } = quotaClient({ whatsapp_monthly_limit: 0, whatsapp_unlimited: true }, 74);

    await expect(getWhatsAppQuotaStatus(client, "owner-1")).resolves.toEqual({
      used: 74,
      limit: null,
      remaining: null,
    });
  });

  it("blocks a spent allowance with contact-us copy that never mentions plans", async () => {
    const { client } = quotaClient({ whatsapp_monthly_limit: 2, whatsapp_unlimited: false }, 2);

    await expect(checkWhatsAppQuota(client, "owner-1")).resolves.toEqual({
      allowed: false,
      reason:
        "You've reached your monthly WhatsApp allowance (2 messages). Contact us to request more.",
    });
  });

  it("allows a send while a finite allowance still has messages remaining", async () => {
    const { client } = quotaClient({ whatsapp_monthly_limit: 2, whatsapp_unlimited: false }, 1);

    await expect(checkWhatsAppQuota(client, "owner-1")).resolves.toEqual({ allowed: true });
  });
});
