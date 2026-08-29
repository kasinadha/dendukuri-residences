# Dendukuri's Residences

Rental property management for Dendukuri's Residences — public marketing site, owner admin, and tenant portal. Built with **Next.js 16** (App Router), React 19, Tailwind CSS 4, and Supabase Auth + Postgres (RLS).

## Features

- **Public site** — property landing page
- **Admin** — flats, tenants, tenancies, rent payments + receipts, electricity, maintenance, water tankers, vendors, FAQs, reports
- **Tenant portal** — rent receipts, electricity readings, maintenance requests, vacate requests (scoped to linked tenancy)

## Setup (local)

1. Copy env and fill from Supabase → Project Settings → API:

```bash
cp .env.example .env.local
```

2. Install and run (prefer **macOS Terminal** — Cursor agent shells may inject HTTP proxies that break Supabase `fetch`):

```bash
npm ci
set -a; source .env.local; set +a
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Login: `/login`.

### Auth redirects (Supabase)

In Supabase → Authentication → URL configuration, add:

- Site URL: `http://localhost:3000` (and your Vercel URL in production)
- Redirect URLs: `http://localhost:3000/**`, `https://YOUR_DOMAIN/**`

### Link a tenant login

**From admin (recommended):** Admin → Tenants → **Create login** — mobile + password. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` / Vercel (server only, not `NEXT_PUBLIC_*`).

**Manual (Supabase):**

1. Create an Auth user (email + password) in Supabase Auth.
2. Insert `profiles` with `role = tenant` and `is_active = true` for that Auth UUID.
3. Set `tenants.profile_id` to that UUID so the portal resolves their flat/tenancy.
4. Keep a correct `tenants.phone` (10-digit) if they should sign in with **mobile + password** (login resolves phone → Auth email via `resolve_login_email`). Run `supabase/migrations/20260815_phase10_login_email_or_mobile.sql` once.

## Deploy on Vercel

1. Import [kasinadha/dendukuri-residences](https://github.com/kasinadha/dendukuri-residences) (or this repo) into Vercel.
2. Set environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — tenant login creation from admin)
3. Deploy. Update Supabase Auth Site URL / redirect allowlist to the Vercel domain.
4. Confirm `/login` → admin dashboard and tenant routes work.

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to the Next.js app.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |

## Notes

- Receipt numbers use `DR-YYYYMM-…` with uniqueness retries (`supabase/migrations`).
- Billing month is stored in `payments.notes` as `billing_month:YYYY-MM`.
- Schema is live-probed — do not invent columns; electricity units = `current_reading − previous_reading`.
