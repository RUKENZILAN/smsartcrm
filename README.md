# Outreach CRM

A lightweight, multi-user CRM that automates outreach via email and SMS/calls when contacts meet configurable conditions on a flexible schedule.

## Features

- **Contact Management** — Track contacts with name, email, phone, company, status, tags, deal value, birthday, and last-contacted date.
- **Smart Outreach Rules** — Create rules that trigger when conditions are met:
  - Days since last contact
  - Contact status (e.g., Lead, Customer, Churned)
  - Deal value threshold
  - Upcoming birthday
- **Flexible Scheduling** — Run rules daily, weekly, monthly, every N days, or once at a specific time.
- **Multi-Channel Outreach** — Send emails (via Resend), SMS, or voice calls (via Twilio).
- **Activity Log** — Full history of every outreach attempt with status, detail, and timestamp.
- **Multi-User Auth** — Email/password and Google OAuth with row-level security so users only see their own data.
- **Dashboard** — At-a-glance stats and upcoming rule runs.

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 + Vite)
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Database:** PostgreSQL via Supabase (Lovable Cloud)
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Email:** Resend API
- **SMS/Calls:** Twilio API
- **Scheduling:** pg_cron (Supabase) hitting a secured cron endpoint every minute

## Project Structure

```
src/
  routes/                  # File-based routes (TanStack Start)
    __root.tsx             # Root layout
    auth.tsx               # Sign in / Sign up page
    index.tsx              # Redirects to /dashboard
    _authenticated/        # Protected routes
      dashboard.tsx        # Stats & upcoming runs
      contacts.tsx         # Contact CRUD
      rules.tsx            # Outreach rule builder
      activity.tsx         # Outreach history
    api/public/cron/       # Public cron endpoint (pg_cron)
  lib/
    rule-engine.server.ts      # Condition evaluation & scheduling logic
    rule-engine-runner.server.ts  # Rule execution engine
    senders.server.ts          # Resend (email) & Twilio (SMS/call) senders
    contacts.functions.ts      # Contact CRUD server functions
    rules.functions.ts         # Rule CRUD & manual run server functions
    logs.functions.ts          # Activity log & stats server functions
  components/              # Reusable UI components
  integrations/supabase/     # Supabase client & auth middleware
```

## Environment Variables

API keys are kept out of the codebase and injected at runtime. Set these in your hosting environment:

| Variable | Required For | Description |
|----------|--------------|-------------|
| `RESEND_API_KEY` | Email sends | Resend API key |
| `EMAIL_FROM` | Email sends | Sender address (default: `onboarding@resend.dev`) |
| `TWILIO_ACCOUNT_SID` | SMS / Calls | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | SMS / Calls | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | SMS / Calls | Twilio sender phone number |

These values are read inside server functions only — they are never exposed to the browser.

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Copy `.env` and fill in your Supabase credentials:
   ```bash
   cp .env .env.local
   ```

3. Run the dev server:
   ```bash
   bun run dev
   ```

4. Open [http://localhost:8080](http://localhost:8080) and sign up.

## Database Migrations

Migrations live in `supabase/migrations/`. The schema includes:

- `profiles` — user profiles linked to auth.users
- `user_roles` — role-based access control
- `contacts` — CRM contact records (RLS-protected per user)
- `outreach_rules` — automation rules with JSON conditions & frequency config
- `outreach_logs` — record of every attempted send (RLS-protected per user)

## Rule Engine

Rules are evaluated server-side every minute via a cron job. For each active rule:

1. Check if `next_run_at` has passed.
2. Find contacts matching the rule’s conditions.
3. Render the message template (supports `{{name}}`, `{{email}}`, `{{company}}`).
4. Send via the chosen channel (email, SMS, or call).
5. Log the result and compute the next run time.

If a channel’s API credentials are missing, the send is recorded as `skipped` with a helpful message — no crashes.

## Live App

Preview: [https://id-preview--c3a58c61-360e-4174-8a9b-126873fc391f.lovable.app](https://id-preview--c3a58c61-360e-4174-8a9b-126873fc391f.lovable.app)

> Publish the project from the Lovable editor to get a permanent public URL.

## License

GPL-3.0
