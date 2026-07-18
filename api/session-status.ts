import Stripe from 'stripe';
import { PLANS, isPlanKey, formatEur } from '../lib/plans.js';
import { doorCodeFor } from '../lib/code.js';

// Used by success.html after Stripe redirects back: looks up the Checkout
// session and returns the booking details plus the same deterministic door
// code the webhook emailed. Only ever returns data for paid sessions, and
// only to someone holding the (unguessable) session id.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function GET(request: Request): Promise<Response> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: 'Not configured.' }, 503);

  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return json({ error: 'Missing session.' }, 400);
  }

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') return json({ paid: false });

    const meta = session.metadata ?? {};
    const planKey = isPlanKey(meta.plan) ? meta.plan : null;
    const planDef = planKey ? PLANS[planKey] : null;

    return json({
      paid: true,
      name: meta.name || session.customer_details?.name || '',
      email: session.customer_details?.email || session.customer_email || '',
      planName: planDef?.name ?? meta.plan ?? 'Booking',
      planUnit: planDef?.unit ?? '',
      date: meta.date || '',
      amount: formatEur(session.amount_total ?? 0),
      code: doorCodeFor(session.id),
    });
  } catch (err) {
    console.error('session-status error:', err);
    return json({ error: 'Could not look up this booking.' }, 502);
  }
}
