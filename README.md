# FutureTrackAI

A personalized AI career and academic guide for teenagers. React + Vite frontend, Supabase (Postgres + Auth + Edge Functions) backend, Claude (Anthropic) for AI generation, Stripe for billing.

## Stack

- **Frontend**: React, Vite, Tailwind, shadcn/ui — deployable to any static host (Vercel, Netlify, Cloudflare Pages, etc.)
- **Backend**: [Supabase](https://supabase.com) — Postgres database, Auth, and Deno Edge Functions
- **AI**: Anthropic Claude (Opus 4.8) via the edge functions in `supabase/functions/`
- **Payments**: Stripe Checkout + webhook

## One-time setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then apply the schema:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates all tables/RLS policies from `supabase/migrations/`.

### 2. Deploy the edge functions

```bash
npx supabase functions deploy
```

Then set the required secrets (Project Settings -> Edge Functions -> Secrets, or via CLI):

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
npx supabase secrets set STRIPE_PRICE_ID=price_...
npx supabase secrets set APP_URL=https://your-deployed-app.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — you don't set those yourself.

In Stripe, point a webhook at `https://<project-ref>.functions.supabase.co/stripe-webhook` listening for `checkout.session.completed`, and create a recurring Price for the subscription (its ID is `STRIPE_PRICE_ID` above).

### 3. (Optional) Nightly school-directory refresh

`supabase/migrations/0002_cron.sql` schedules `nightlyZipRefresh` via `pg_cron`. Before running it, store your project URL and service-role key in Supabase Vault (see the comment at the top of that file) — no secrets are hardcoded in the migration.

### 4. Configure the frontend

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings -> API.

## Local development

```bash
npm install
npm run dev
```

## Deploying the frontend

`npm run build` produces a static `dist/` folder — deploy it to Vercel, Netlify, Cloudflare Pages, or any static host, with the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars set in that host's dashboard.

## Admin access

The first user needs their `role` promoted to `admin` directly in the database (admin-only actions include seeding the school directory and aborting stuck plan generations):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
