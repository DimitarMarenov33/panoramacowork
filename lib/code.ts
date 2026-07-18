import { createHmac, randomInt } from 'node:crypto';

/**
 * Deterministic 6-digit door code derived from a Stripe session id.
 * Deterministic on purpose: Stripe retries webhooks, and the success page
 * computes the same code independently — no database needed, and retries
 * never produce a second, conflicting code for the same booking.
 */
export function doorCodeFor(sessionId: string): string {
  const secret =
    process.env.CODE_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    'panorama-dev-only-secret';
  const digest = createHmac('sha256', secret).update(sessionId).digest();
  const n = 100000 + (digest.readUInt32BE(0) % 900000);
  return String(n);
}

/** Random 6-digit code for bookings without a Stripe session (free first day). */
export function randomDoorCode(): string {
  return String(randomInt(100000, 1000000));
}
