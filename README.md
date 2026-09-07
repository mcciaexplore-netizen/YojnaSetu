# YojanaSetu

**MSME Scheme Eligibility Finder — One Profile. Many Opportunities.**

A connected Next.js application for business profiles, explainable scheme recommendations, saved opportunities, document checklists, application tracking, notifications, and administrator review.

## Current delivery status

The local application works with persistent, explicitly labelled demonstration data. The production path uses Supabase Auth, PostgreSQL with row-level security, and a private Supabase Storage bucket. A real Supabase project is not configured in this checkout, so live authentication, live storage, email delivery, and a production deployment have not been exercised. Production never falls back to the local demo database.

The 14 seed records are **illustrative product-testing records, not invented claims about actual government schemes**. They have no official URLs and are never marked Verified. All figures and deadlines are examples. Replace them with reviewed official data before offering real application guidance. The app does not claim government affiliation or guaranteed approval.

## Run locally

Requirements: Node.js 22.13 or later (Node 24 recommended), npm.

```powershell
cd D:\YojanaSetu
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open **http://127.0.0.1:3000**. In PowerShell, use `npm.cmd` if execution policy prevents `npm.ps1` from running. In other shells, use `npm`.

`.env.local` is already created for the delivered local demo. Do not overwrite it if you have subsequently configured Supabase.

1. Choose Find My Eligible Schemes and create an account with a test email and a password of at least 12 characters.
2. Complete the six-step profile. Save progress at any step, review, and confirm.
3. Explore matches, change filters, open a scheme, and save it.
4. Create a checklist, upload a PDF/PNG/JPEG under 5 MB, and save application updates.
5. Download recommendations as PDF and saved schemes as CSV.

Local accounts, profiles, uploads, and records persist in `.data/demo.json`, which is excluded from source control. Use test information only. Local mode is a single-instance development adapter, not a production datastore. Passwords use salted PBKDF2; session cookies are HTTP-only with opaque, expiring tokens. Demo mode is disabled whenever `NODE_ENV=production`.

For local administration, register the email explicitly configured in `DEMO_ADMIN_EMAIL` (default `admin@yojanasetu.local`). No default password is shipped. The automated flow suite may create that test account using the password documented in the test source; remove test accounts with the cleanup procedure below before sharing a local machine. Production never derives administrator rights from an email address.

## Connect Supabase

1. Create a Supabase project.
2. In the SQL editor, execute these files in order as the database owner:
   - `supabase/migrations/202609050001_initial.sql`
   - `supabase/migrations/202609050002_deadlines.sql`
3. Optionally execute `supabase/seed.sql` **once** to load the labelled demonstration catalogue. For production, import reviewed real records instead.
4. Set `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
DEMO_MODE=false
```

Use a publishable/anonymous client key, **never a service-role key**, in the Next.js application. Row-level security enforces ownership. The app fails closed if Supabase is unavailable.

5. Enable Supabase email/password authentication. Configure the Site URL and redirect allowlist with your app's `/auth/callback` URL. Configure SMTP and email templates for production delivery.
6. Register and confirm your first administrator account. Promote it using the SQL editor, replacing the example email:

```sql
update public.users set role = 'admin' where email = 'your-admin@example.com';
```

Do not expose this SQL through a public endpoint. Normal users cannot alter their role. User metadata is never trusted for administrator authorization.

The migration creates the `application-documents` private bucket, with a 5 MB limit and PDF/JPEG/PNG MIME allowlist. Uploads are checked for file signatures by the API; storage paths are scoped to the authenticated user. Downloads require ownership and use short-lived signed URLs in Supabase mode. Antivirus scanning can be added before document processing; uploaded documents are not executed or parsed by this application.

## Production deployment

The canonical application is Next.js 16 / React 19. Deploy to a Node-capable Next.js host such as a managed Next.js service or your own Node server:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run db:check
npm run build
npm start
```

Configure the three Supabase/site variables above in the host, set `DEMO_MODE=false`, use an HTTPS site URL, and add the exact deployed `/auth/callback` to Supabase's redirect allowlist. Never upload `.env.local`, `.data`, test artifacts, or the parent IVR project. Configure durable backups and monitoring in the Supabase project.

The project also preserves the Sites-compatible build adapter:

```sh
npm run sites:dev
npm run sites:build
```

Sites metadata is in `.openai/hosting.json`; this project uses external Supabase over HTTPS, so D1/R2 bindings are unused. Sites publishing must wait for a working Supabase connection: a production deployment without it intentionally returns a configuration error for account APIs. Set runtime variables through the hosting platform and keep the production site origin consistent with authentication redirects and social metadata.

## Notifications and email

In-app notifications cover profile matching, application status, saved scheme updates, and manually added deadline reminders. The profile page and dashboard also show incomplete-profile guidance. `queue_deadline_notifications()` generates deduplicated upcoming-deadline notifications for saved schemes within 14 days. Run it daily using a trusted scheduler:

```sql
-- Enable the pg_cron extension in Supabase first.
select cron.schedule(
  'yojanasetu-deadlines', '0 3 * * *',
  'select public.queue_deadline_notifications()'
);
```

Email preferences persist, but the local demo does not send email. A deployable Supabase Edge Function is provided at `supabase/functions/notification-delivery/index.ts`. Configure these **Edge Function secrets only**:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (provided by Supabase's runtime)
- `NOTIFICATION_JOB_SECRET` (a strong random scheduler credential)
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL` (a verified sender)

Deploy `notification-delivery`, then invoke it from a trusted scheduler with `Authorization: Bearer <NOTIFICATION_JOB_SECRET>`. The function authenticates that job secret, checks current user preferences and notification ownership, uses idempotency keys, retries failed jobs up to five times, and records failed deliveries. No email was sent during development. WhatsApp/SMS channels are reserved in the outbox model and have no active delivery implementation.

## Catalogue and eligibility rules

Administrators can add/edit/archive schemes, update fields, official links, required documents and application steps, manage categories/industries/states, view users and enquiries, and inspect analytics. Eligibility rules are edited as validated JSON in the admin editor. Example:

```json
{
  "id": "turnover-limit",
  "field": "turnover",
  "operator": "range",
  "value": [0, 100000000],
  "label": "Annual turnover within the recorded limit",
  "required": true,
  "weight": 15
}
```

Rules support industry, state, business type, stage, turnover, investment, employees, registrations, objectives, exporting, planned exports, and ownership. Operators: `in`, `range`, `all`, `any`, `equals`. Monetary values are full INR amounts, not lakh/crore units. Weights are 1–100.

The engine calculates the passed weight divided by total weight. A failed required condition caps the score below 50, excluding it from default recommendations. Unknown data earns no points and remains Needs verification. Missing rules and expired schemes never qualify. Scores label relevance: 90–100 Highly Relevant, 75–89 Strong Match, 50–74 Potential Match. Passing stored rules is not a guarantee of approval. Demo and review records always retain their warning.

Verified records require non-demo status, a recorded official source URL, a valid verification date, and eligibility rules. Administrator review is still responsible for source authenticity and complete conditions. Archive schemes to deactivate them without destroying application history. The assistant uses only Verified, non-demo records and returns the specified unavailable-information response when none support the question; it is deterministic database assistance rather than an external LLM.

## Architecture

- `app/`: App Router pages, authentication callback, API routes, shared metadata.
- `components/features/`: separate profile, discovery, scheme, application, auth, and administration screens.
- `components/ui/`: shadcn primitives; shared components and responsive shell sit alongside them.
- `hooks/use-app.tsx`: account loading, mutations, feedback, and refresh.
- `lib/matching.ts`: shared eligibility scoring and search.
- `lib/validation.ts`: Zod schemas, supported fields, profile completion.
- `services/auth.ts`: Supabase SSR authentication and local session adapter.
- `services/repository.ts`: central database access; UI does not embed scheme data.
- `services/demo-store.ts`: persistent local testing adapter.
- `services/reports.ts`: PDF and safe CSV formatting.
- `database/seed.ts`: canonical demonstration records; `npm run db:seed` regenerates SQL.
- `supabase/`: migrations, seed, email delivery worker.
- `tests/`: matching, report, local API flow, and PostgreSQL/RLS verification.

The normalized database has users, profiles, objectives, schemes, eligibility rules, benefits, documents, deadlines, saved schemes, applications, application documents, notifications, audit logs, events, taxonomy, enquiries, and notification delivery jobs. JSON payloads preserve typed domain records while relational keys enforce ownership and relationships. Account writes use an atomic RPC with optimistic version checks; stale writes are rejected. Admin changes use a separate privileged RPC. Policies are enabled on all 17 application tables.

## Validation and practical limits

```sh
npm run typecheck
npm run lint
npm test
npm run db:check
npm run dev
# In a second terminal, with the local demo running on 127.0.0.1:3000:
npm run test:flows
npm run build
```

The flow suite checks registration, draft/confirmed profiles, scheme data, saves/notes, checklists, private upload/download, PDF/CSV export, tracker updates, notifications, enquiries, assistant grounding, account isolation, CSRF, admin permissions, logout/login persistence, admin create/edit/archive, and page responses. Unit tests cover scoring boundaries, unknown conditions, required failures, empty/expired rules, validation, search, and report generation. The migration suite executes PostgreSQL via PGlite with test-only Supabase auth/storage fixtures; this validates SQL and policies but does **not** replace deployment testing against a live Supabase project.

A connected browser was unavailable during development. Page HTTP responses and API flows were verified; interactive DOM, keyboard, and viewport testing remain a release check. Responsive layouts, labels, focus states, reduced-motion handling, and semantic form controls are implemented. PDF exports were rendered and visually inspected. The report currently uses a standard Latin PDF font; unsupported scripts are replaced with `?`, so extend embedded fonts before deploying for multilingual names.

The Edge Function requires a Supabase/Deno runtime and configured email service; it is excluded from the Next.js TypeScript check. Live auth confirmation/recovery, live storage, scheduled execution, and email delivery require their integration tests after configuration. No external MCCIA messages are sent: enquiries are stored for administrator review.

Automated test data uses `flow-<timestamp>@example.test`, `other-flow-<timestamp>@example.test`, and a local admin test account. To reset **all local demo data**, stop the server and delete only `yojanasetu/.data/demo.json`; the app will recreate the labelled catalogue. Do not do this after entering data you want to keep. It never affects Supabase.
