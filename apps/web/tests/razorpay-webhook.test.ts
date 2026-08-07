import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyRazorpayWebhook } from "@/lib/plan-checkout.server";

const SECRET = "whsec_test_5f3a91";
const OTHER_SECRET = "whsec_test_different";

/** A realistic payment.captured delivery, as the raw bytes Razorpay sends. */
const RAW_BODY = JSON.stringify({
  event: "payment.captured",
  payload: {
    payment: {
      entity: { id: "pay_QxYz123", order_id: "order_QxAb456", amount: 49900, status: "captured" },
    },
  },
});

const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("hex");

describe("verifyRazorpayWebhook", () => {
  const original = process.env["RAZORPAY_WEBHOOK_SECRET"];

  beforeEach(() => {
    process.env["RAZORPAY_WEBHOOK_SECRET"] = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env["RAZORPAY_WEBHOOK_SECRET"];
    else process.env["RAZORPAY_WEBHOOK_SECRET"] = original;
  });

  it("accepts a delivery signed with the webhook secret", () => {
    expect(verifyRazorpayWebhook(RAW_BODY, sign(RAW_BODY))).toBe(true);
  });

  it("rejects a body altered after signing", () => {
    const signature = sign(RAW_BODY);
    const tampered = RAW_BODY.replace('"amount":49900', '"amount":100');
    expect(tampered).not.toBe(RAW_BODY);
    expect(verifyRazorpayWebhook(tampered, signature)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyRazorpayWebhook(RAW_BODY, sign(RAW_BODY, OTHER_SECRET))).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyRazorpayWebhook(RAW_BODY, null)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyRazorpayWebhook(RAW_BODY, "")).toBe(false);
  });

  it("rejects a truncated signature without throwing on the length mismatch", () => {
    const short = sign(RAW_BODY).slice(0, 32);
    expect(() => verifyRazorpayWebhook(RAW_BODY, short)).not.toThrow();
    expect(verifyRazorpayWebhook(RAW_BODY, short)).toBe(false);
  });

  it("is keyed by the webhook secret, not the API key secret", () => {
    process.env["RAZORPAY_KEY_SECRET"] = "api_key_secret_value";
    expect(verifyRazorpayWebhook(RAW_BODY, sign(RAW_BODY, "api_key_secret_value"))).toBe(false);
  });

  it("throws when no webhook secret is configured, so the route can answer 500 and be retried", () => {
    delete process.env["RAZORPAY_WEBHOOK_SECRET"];
    expect(() => verifyRazorpayWebhook(RAW_BODY, sign(RAW_BODY))).toThrow(
      /RAZORPAY_WEBHOOK_SECRET/,
    );
  });

  it("fails if the body was parsed and re-serialised instead of passed through raw", () => {
    // Why the route reads request.text() and not request.json(): re-serialising
    // drops the sender's exact byte layout and the HMAC no longer matches.
    const spaced = JSON.stringify(JSON.parse(RAW_BODY), null, 2);
    expect(verifyRazorpayWebhook(spaced, sign(RAW_BODY))).toBe(false);
  });
});
