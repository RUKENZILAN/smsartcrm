
## What I'll build

A multi-user CRM where you manage contacts and create **outreach rules** that automatically email, SMS, or call them when a condition is met, on a daily / weekly / monthly / custom / one-time schedule.

API keys (Twilio) are stored as Lovable Cloud secrets — never in the codebase or the frontend.

## Core features

**Contacts**
- Name, email, phone, company, status (lead / prospect / customer / lost), tags, last contacted date, birthday, custom field (numeric "deal value")
- Search, filter, edit, delete — each user only sees their own contacts (RLS)

**Outreach Rules**
- Channel: Email, SMS, or Voice call (pick any combination)
- Condition (any combination):
  - Days since last contact ≥ N
  - Status equals X
  - Custom field (deal value) >, <, = N
  - Birthday is today / within N days
- Frequency:
  - Daily / Weekly (pick weekday) / Monthly (pick day-of-month)
  - Custom: every N days
  - One-time: specific date/time
- Message template with `{{name}}`, `{{company}}` variables
- Enable/disable toggle, last-run timestamp, next-run timestamp

**Activity log**: every send attempt with status (sent / failed / skipped), channel, contact, timestamp.

**Dashboard**: contact count, active rules, sends in last 7 days, upcoming runs.

## Tech approach

- **Lovable Cloud** for auth (email/password + Google), database, RLS
- **Lovable Emails** for the email channel (no API key needed)
- **Twilio** for SMS + voice — you'll add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` via the secure secrets form. Server functions read them from `process.env`; they never touch the frontend bundle.
- **pg_cron** runs a public scheduled endpoint every minute that evaluates due rules, checks conditions per contact, sends through the correct channel, logs results, and computes the next run.

## Pages

- `/auth` — sign in / sign up
- `/` (protected) — dashboard
- `/contacts` — list + create/edit dialog
- `/rules` — list + create/edit rule builder
- `/activity` — send log

## Technical details

- Tables: `profiles`, `contacts`, `outreach_rules`, `outreach_logs` — all RLS-scoped to `auth.uid()`
- `user_roles` table + `has_role()` SECURITY DEFINER function (not used for gating now but ready for admin features)
- Server functions in `src/lib/*.functions.ts` for CRUD + manual "test send"
- Public server route `/api/public/cron/process-rules` for pg_cron, protected by HMAC secret
- Twilio calls use a TwiML `<Say>` of the rendered message (simple text-to-speech)

Sound good? I'll start once you approve.
