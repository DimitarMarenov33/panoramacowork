import Stripe from 'stripe';
import { PLANS, priceCents, isPlanKey, isValidBookingDate, isValidEmail } from '../lib/plans';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(request: Request): Promise<Response> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set');
    return json({ error: 'Payments are not configured yet.' }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const { plan, date, name, email, company } = body as {
    plan?: unknown; date?: unknown; name?: unknown; email?: unknown; company?: unknown;
  };

  if (!isPlanKey(plan)) return json({ error: 'Unknown plan.' }, 400);
  if (!isValidBookingDate(date)) return json({ error: 'Pick a start date from today onward.' }, 400);
  if (typeof name !== 'string' || !name.trim() || name.length > 120) return json({ error: 'Please enter your name.' }, 400);
  if (!isValidEmail(email)) return json({ error: 'Please enter a valid email.' }, 400);
  const companyStr = typeof company === 'string' ? company.trim().slice(0, 120) : '';

  const amount = priceCents(plan, date);
  if (amount === null || amount <= 0) {
    return json({ error: 'This plan cannot be paid online — use the request form instead.' }, 400);
  }

  const planDef = PLANS[plan];
  const origin =
    process.env.SITE_URL || request.headers.get('origin') || 'https://panoramaco.work';

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Cards only: async methods (SEPA etc.) would redirect to the success
      // page before the payment settles and delay the door-code email.
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: `${planDef.name} — Panorama Co.Space`,
              description: `${planDef.unit} · starting ${date} · Nesebar, 200m from the sea`,
            },
          },
        },
      ],
      metadata: {
        plan,
        date,
        name: name.trim().slice(0, 120),
        company: companyStr,
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return json({ error: 'Could not start the payment.' }, 502);
  }
}
