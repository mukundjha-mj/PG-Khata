import { timingSafeEqual } from "crypto";

/** Length-safe constant-time comparison for webhook secrets and signatures. */
export function constantTimeEqual(expected: string, provided: string | null | undefined) {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided ?? "");
  return (
    expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
  );
}
