# Verification record — 5 September 2026

The application is in `D:\YojanaSetu`.

## Passed

- TypeScript strict check.
- ESLint, without reported errors.
- Next.js optimized production build.
- Sites/Vinext/Cloudflare-compatible build.
- npm dependency audit: zero vulnerabilities after compatible security updates.
- Nine matching, validation, search, CSV-safety, and PDF tests.
- Both PostgreSQL migrations execute using PGlite with Supabase auth/storage fixtures.
- All 17 application tables have row-level security enabled.
- Database tests confirm owner isolation, denied role escalation, stale-write rejection, and administrator access.
- Local API flow: sign up, draft profile, confirmed profile, catalogue, matching notifications, save/notes, checklist, PDF generation, private upload/download, tracking/timeline, CSV, reminders, mark-read, enquiry, grounded assistant, two-user isolation, CSRF rejection, admin denial, logout/login persistence, admin create/edit/archive, and all page responses.
- Recommendation PDF rendered and visually inspected at first and last pages; final sample is five pages with valid text and page numbers.
- Branded social preview visually inspected; root and item-specific metadata implemented.

## Not verified / configuration required

- No live Supabase project URL/key was supplied. Live sign-up confirmation, recovery emails, RLS on an actual Supabase deployment, and Supabase Storage integration were not exercised.
- The notification Edge Function was authored but not deployed or executed. It requires Supabase/Deno plus email provider and scheduler secrets.
- Browser runtime discovery returned no connected browsers. HTTP/API tests passed, but interactive DOM, keyboard, and responsive viewport testing could not run.
- No production site was published. Production account APIs intentionally fail closed without Supabase configuration.
- Seed records are illustrative and unverified. Import complete, reviewed official scheme records before real eligibility guidance.
- PDF output uses a Latin font; unsupported scripts are substituted. Embedded multilingual fonts are a remaining requirement for multilingual deployment.

See README.md for setup, local administration, migrations, deployment, and email scheduling.
