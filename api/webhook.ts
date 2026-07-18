import Stripe from 'stripe';
import { PLANS, isPlanKey, formatEur } from '../lib/plans.js';
import { doorCodeFor } from '../lib/code.js';
import { sendBookingEmails } from '../lib/email.js';

// Stripe webhook: on a completed, paid Checkout session we generate the door
// code and email both the client and the owner. The code is derived
// deterministically from the session id, so Stripe's webhook retries and the
// success page always agree on the same code.

export async function POST(request: Request): Promise<Response> {
  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whSecret) {
    console.error('Stripe env vars missing (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)');
    return new Response('Webhook not configured', { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const payload = await request.text();
  const stripe = new Stripe(key);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, whSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Belt and braces: also handle async payment methods, should they ever be
  // enabled on the Stripe account (checkout.ts currently restricts to cards).
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid') {
      const meta = session.metadata ?? {};
      const planKey = isPlanKey(meta.plan) ? meta.plan : null;
      const planDef = planKey ? PLANS[planKey] : null;
      const email = session.customer_details?.email || session.customer_email;

      if (!email) {
        console.error(`Session ${session.id} completed but has no customer email`);
      } else {
        await sendBookingEmails({
          name: meta.name || session.customer_details?.name || 'Guest',
          email,
          company: meta.company || undefined,
          planName: planDef?.name ?? meta.plan ?? 'Booking',
          planUnit: planDef?.unit ?? '',
          date: meta.date || 'as booked',
          amount: formatEur(session.amount_total ?? 0),
          code: doorCodeFor(session.id),
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
