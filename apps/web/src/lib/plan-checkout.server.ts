import { createHmac, timingSafeEqual } from "crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function razorpayCreds() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured yet. Add your Razorpay key id and key secret to enable checkout.",
    );
  }
  return { keyId, keySecret };
}

export async function createRazorpayOrder(input: {
  amountInPaise: number;
  receipt: string;
  notes: Record<string, string>;
}) {
  const { keyId, keySecret } = razorpayCreds();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Razorpay order failed [${res.status}]: ${body}`);
    throw new Error(`Could not start checkout [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountInPaise: number;
  notes: Record<string, string>;
}) {
  const { keyId, keySecret } = razorpayCreds();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`${RAZORPAY_API}/payments/${input.paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      notes: input.notes,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Razorpay refund failed [${res.status}]: ${body}`);
    throw new Error(`Could not process refund [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id: string; amount: number; status: string };
}

export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { keySecret } = razorpayCreds();
  const expected = createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return constantTimeEqual(expected, input.signature);
}

/**
 * Verifies a webhook delivery from Razorpay.
 *
 * Two things differ from checkout verification above and both matter: the HMAC
 * is taken over the raw request body, so the bytes must not have been through
 * JSON.parse and re-serialised, and it is keyed by the webhook secret from the
 * dashboard rather than the API key secret.
 */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null) {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEqual(expected, signature);
}

/** Length-safe constant-time compare. timingSafeEqual throws on length mismatch. */
export function constantTimeEqual(expected: string, provided: string | null | undefined) {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
