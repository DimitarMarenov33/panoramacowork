import { PLANS, isPlanKey, isValidBookingDate, isValidEmail } from '../lib/plans';
import { randomDoorCode } from '../lib/code';
import { sendBookingEmails, sendInquiryEmails } from '../lib/email';

// Handles the two flows that don't go through Stripe:
//  - "free"  → Free First Day: generate a door code, email client + owner.
//  - "event" → Event Rental inquiry: email owner (and an acknowledgement to the client).

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const { plan, date, name, email, company } = body as {
    plan?: unknown; date?: unknown; name?: unknown; email?: unknown; company?: unknown;
  };

  if (!isPlanKey(plan) || (plan !== 'free' && plan !== 'event')) {
    return json({ error: 'This plan requires payment.' }, 400);
  }
  if (!isValidBookingDate(date)) return json({ error: 'Pick a date from today onward.' }, 400);
  if (typeof name !== 'string' || !name.trim() || name.length > 120) return json({ error: 'Please enter your name.' }, 400);
  if (!isValidEmail(email)) return json({ error: 'Please enter a valid email.' }, 400);
  const companyStr = typeof company === 'string' ? company.trim().slice(0, 120) : '';

  const planDef = PLANS[plan];
  const base = {
    name: name.trim().slice(0, 120),
    email,
    company: companyStr || undefined,
    planName: planDef.name,
    planUnit: planDef.unit,
    date,
  };

  if (plan === 'event') {
    await sendInquiryEmails({ ...base, amount: 'Quote within 24h' });
    return json({ inquiry: true });
  }

  const code = randomDoorCode();
  await sendBookingEmails({ ...base, amount: 'Free', code });
  return json({ code });
}
