// Email sending via the Resend HTTP API (no SDK dependency).
// If RESEND_API_KEY is not configured, sends are skipped with a console warning
// so the payment flow itself never fails because of email problems.

const RESEND_URL = 'https://api.resend.com/emails';

export interface BookingDetails {
  name: string;
  email: string;
  company?: string;
  planName: string;
  planUnit: string;
  date: string;
  /** Already-formatted amount, e.g. "€139" or "Free". */
  amount: string;
  code?: string;
}

function ownerEmail(): string {
  return process.env.OWNER_EMAIL || 'dev@gmu.online';
}

function fromAddress(): string {
  // Until panoramaco.work is verified in Resend, use their onboarding sender.
  return process.env.FROM_EMAIL || 'Panorama Co.Space <onboarding@resend.dev>';
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`RESEND_API_KEY not set — skipped email "${subject}" to ${to}`);
    return;
  }
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress(), to: [to], reply_to: ownerEmail(), subject, html }),
  });
  if (!res.ok) {
    console.error(`Resend error ${res.status} for "${subject}" to ${to}:`, await res.text());
  }
}

/* ---------- templates ---------- */

const NAVY = '#1E2A44';
const CREAM = '#F4EDDE';
const MUSTARD = '#E8B54D';
const ORANGE = '#D9822B';
const BROWN = '#9C6B3F';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shell(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${CREAM};font-family:'Avenir Next',Avenir,'Segoe UI','Helvetica Neue',sans-serif;color:${NAVY};">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:${NAVY};border:3px solid ${NAVY};border-radius:14px 14px 0 0;padding:18px 26px;">
      <span style="color:${CREAM};font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:14px;">Panorama Co.Space</span>
      <span style="color:${MUSTARD};font-size:12px;float:right;padding-top:2px;">Nesebar · 200m from the sea</span>
    </div>
    <div style="background:#fff;border:3px solid ${NAVY};border-top:0;border-radius:0 0 14px 14px;padding:28px 26px;">
      <h1 style="font-size:20px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 14px;color:${ORANGE};">${title}</h1>
      ${inner}
    </div>
    <p style="font-size:11px;color:${BROWN};text-align:center;margin-top:14px;">
      Panorama Co.Space · Nesebar, Bulgaria · <a href="mailto:hello@panoramaco.work" style="color:${BROWN};">hello@panoramaco.work</a> · <a href="https://panoramaco.work" style="color:${BROWN};">panoramaco.work</a><br>
      Prices include VAT.
    </p>
  </div>
</body></html>`;
}

function detailRows(rows: Array<[string, string]>): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:2px dashed rgba(30,42,68,.2);color:${BROWN};text-transform:uppercase;font-size:11px;letter-spacing:.1em;">${esc(k)}</td><td style="padding:8px 0;border-bottom:2px dashed rgba(30,42,68,.2);text-align:right;font-weight:600;">${esc(v)}</td></tr>`
    )
    .join('')}</table>`;
}

function codeBlock(code: string): string {
  return `<div style="background:${NAVY};color:${MUSTARD};border-radius:12px;padding:18px;text-align:center;font-size:30px;font-weight:900;letter-spacing:.28em;margin:18px 0 6px;">${esc(code)}</div>
  <p style="font-size:13px;text-align:center;color:${BROWN};margin:0 0 8px;">Your door code — type it on the keypad at the entrance.<br>It activates on your start date.</p>`;
}

export function clientBookingEmail(b: BookingDetails): { subject: string; html: string } {
  const first = esc(b.name.split(' ')[0]);
  const inner = `
    <p style="font-size:15px;">Hi ${first} — you're booked. See you at the space!</p>
    ${detailRows([
      ['Plan', `${b.planName} (${b.planUnit})`],
      ['Starts', b.date],
      ['Paid', b.amount],
    ])}
    ${b.code ? codeBlock(b.code) : ''}
    <p style="font-size:13px;color:${BROWN};">Doors, WiFi, coffee and an external monitor will be waiting. If anything's off — including WiFi down for more than 15 minutes — that day is free. Just reply to this email.</p>`;
  return { subject: `You're booked — ${b.planName} at Panorama Co.Space`, html: shell("You're booked", inner) };
}

export function ownerBookingEmail(b: BookingDetails): { subject: string; html: string } {
  const inner = `
    <p style="font-size:15px;">A new booking just came in.</p>
    ${detailRows([
      ['Name', b.name],
      ['Email', b.email],
      ...(b.company ? ([['Company', b.company]] as Array<[string, string]>) : []),
      ['Plan', `${b.planName} (${b.planUnit})`],
      ['Starts', b.date],
      ['Paid', b.amount],
    ])}
    ${b.code ? codeBlock(b.code) : ''}
    <p style="font-size:13px;color:${BROWN};"><b>Action:</b> program this code into the door lock for the booking period (from the start date above).</p>`;
  return { subject: `New booking: ${b.planName} — ${b.name} (${b.date})`, html: shell('New booking', inner) };
}

export function clientInquiryEmail(b: BookingDetails): { subject: string; html: string } {
  const first = esc(b.name.split(' ')[0]);
  const inner = `
    <p style="font-size:15px;">Hi ${first} — we got your event request and will reply within 24 hours with availability and a quote.</p>
    ${detailRows([
      ['Request', b.planName],
      ['Preferred date', b.date],
      ...(b.company ? ([['Company', b.company]] as Array<[string, string]>) : []),
    ])}
    <p style="font-size:13px;color:${BROWN};">In a hurry? Just reply to this email.</p>`;
  return { subject: 'We got your event request — Panorama Co.Space', html: shell('Request received', inner) };
}

export function ownerInquiryEmail(b: BookingDetails): { subject: string; html: string } {
  const inner = `
    <p style="font-size:15px;">New event rental request — reply within 24 hours.</p>
    ${detailRows([
      ['Name', b.name],
      ['Email', b.email],
      ...(b.company ? ([['Company', b.company]] as Array<[string, string]>) : []),
      ['Preferred date', b.date],
    ])}`;
  return { subject: `Event request: ${b.name} (${b.date})`, html: shell('Event request', inner) };
}

/** Sends both sides of a booking (client + owner). Never throws. */
export async function sendBookingEmails(b: BookingDetails): Promise<void> {
  const client = clientBookingEmail(b);
  const owner = ownerBookingEmail(b);
  const results = await Promise.allSettled([
    sendEmail(b.email, client.subject, client.html),
    sendEmail(ownerEmail(), owner.subject, owner.html),
  ]);
  for (const r of results) if (r.status === 'rejected') console.error('Email send failed:', r.reason);
}

/** Sends both sides of an event inquiry. Never throws. */
export async function sendInquiryEmails(b: BookingDetails): Promise<void> {
  const client = clientInquiryEmail(b);
  const owner = ownerInquiryEmail(b);
  const results = await Promise.allSettled([
    sendEmail(b.email, client.subject, client.html),
    sendEmail(ownerEmail(), owner.subject, owner.html),
  ]);
  for (const r of results) if (r.status === 'rejected') console.error('Email send failed:', r.reason);
}
