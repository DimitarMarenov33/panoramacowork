# Panorama Co.Space — panoramaco.work

Booking website for Nesebar's first coworking space. Static landing page + Vercel
serverless functions: visitors pick a plan and start date, pay with Stripe, and
both sides get an email — the **owner** receives the client's details and the
6-digit door code to program into the lock; the **client** receives the same
code to type on the door keypad.

## How it works

```
index.html  ── booking modal ──►  POST /api/checkout ──► Stripe Checkout (card payment)
                                                              │
             Stripe redirect ◄────────────────────────────────┤
                    │                                         ▼ (webhook)
        success.html ──► GET /api/session-status         POST /api/webhook
             shows door code                             verifies signature,
                                                         emails client + owner

Free first day / event requests ──► POST /api/free-booking (no card, emails only)
```

- **Door codes** for paid bookings are derived deterministically from the Stripe
  session id (`HMAC(CODE_SECRET, session_id) → 6 digits`), so webhook retries and
  the success page always show the same code — no database needed for the beta.
- Prices are defined **server-side** in `lib/plans.ts` (EUR cents, seasonal:
  summer = 15 May–30 Sep). The client-side price list is display-only.
- Emails are sent through [Resend](https://resend.com)'s HTTP API. If the API key
  is missing, the payment still succeeds and the skip is logged.

## Repo layout

| Path | Purpose |
|---|---|
| `index.html` | Landing page + booking modal (the beta design, wired to the real API) |
| `success.html` | Post-payment page, shows the door code |
| `api/checkout.ts` | Creates the Stripe Checkout session |
| `api/webhook.ts` | Stripe webhook → generates code, sends both emails |
| `api/free-booking.ts` | Free first day + event rental requests |
| `api/session-status.ts` | Booking details for the success page |
| `lib/plans.ts` | Plan catalog & seasonal pricing (source of truth) |
| `lib/code.ts` | 6-digit door code generation |
| `lib/email.ts` | Email templates + Resend sending |
| `scripts/extract-assets.mjs` | Pulls the four photos out of the original beta HTML |
| `img/` | Site photos: `logo.jpg`, `desk.jpg`, `interior.jpg`, `promenade.jpg` |

## One-time setup

### 1. Photos

`img/` contains everything the site uses: `desk.jpg`, `interior.jpg`,
`promenade.jpg`, the animated hero background `hero.mp4` (compressed, audio
stripped for reliable autoplay), the brand emblem `logo.png` (nav), the full
lockup `logo-full.png` (footer), and `favicon.png`.

### 2. Stripe

1. Create/log into [Stripe](https://dashboard.stripe.com), activate the business
   (Bulgaria, EUR).
2. Copy the **secret key** (`sk_test_…` first, `sk_live_…` for launch).
3. After the first deploy: **Developers → Webhooks → Add endpoint**
   - URL: `https://panoramaco.work/api/webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the **signing secret** (`whsec_…`).

### 3. Resend (email)

1. Create a [Resend](https://resend.com) account.
2. **Domains → Add** `panoramaco.work`, add the DNS records it gives you
   (works alongside the Vercel DNS records).
3. Create an API key.
4. Until the domain is verified you can leave `FROM_EMAIL` unset — it falls back
   to Resend's onboarding sender (fine for testing, only delivers to your own
   account email).

### 4. Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import
   `DimitarMarenov33/panoramacowork`. No framework preset needed (it's static
   files + an `api/` directory); default settings work.
2. **Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 2.3 |
| `RESEND_API_KEY` | `re_…` |
| `OWNER_EMAIL` | where booking notifications go (defaults to `dev@gmu.online`) |
| `FROM_EMAIL` | `Panorama Co.Space <bookings@panoramaco.work>` (after domain verify) |
| `SITE_URL` | `https://panoramaco.work` |
| `CODE_SECRET` | any long random string — **changing it changes all future door codes** |

3. **Settings → Domains** → add `panoramaco.work` and follow the DNS
   instructions at your registrar.

### 5. Test the whole flow

With `sk_test_…` + the test-mode webhook secret set:

1. Open the site → **Book a desk** → pick *Day Pass* → fill the form.
2. Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. You should land on `/success.html` showing a 6-digit code, and two emails
   should arrive (client + owner) with the same code.
4. Also test **Free First Day** (no card) and **Event Rental** (inquiry email).

Local API testing without deploying: `npx vercel dev` (needs `vercel login`).

## Development

```bash
npm install
npm run typecheck
```

## Beta limitations (deliberate, for later)

- **No availability/capacity tracking** — every booking is accepted; the owner
  manages capacity manually. Add a database (e.g. Vercel Postgres) when needed.
- **Monthly plans are charged as one-time payments** — auto-renewing
  subscriptions (Stripe Billing) are phase 2, as is the €49 onboarding fee,
  invoices for companies, and the 28-day-cycle idea from the strategy doc.
- **Free-day bookings are not rate-limited.**
- Bulgarian/EU consumer rules from the strategy doc (withdrawal rights, auto-renewal
  consent, prize-draw rules) still need the planned legal review before launch.
