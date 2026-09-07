# Connect YojanaSetu to Neon

Use the YojanaSetu folder (`D:\YojanaSetu`). The existing UI uses Neon automatically when all required Neon values are configured. Incomplete Neon settings produce a configuration error rather than using demo accounts.

## 1. Keep connection settings in .env.local

```env
DATABASE_URL="your-pooled-Neon-Postgres-URL"
DATABASE_URL_UNPOOLED="your-direct-Neon-Postgres-URL"
NEON_AUTH_BASE_URL="your-Neon-Auth-URL"
NEON_AUTH_COOKIE_SECRET="your-random-secret-at-least-32-characters-long"
NEXT_PUBLIC_SITE_URL="http://127.0.0.1:3000"
```

Use the current Neon Auth integration, not legacy Stack Auth keys. These are server settings; do not add `NEXT_PUBLIC_` or `VITE_` to secrets. `.env.local` is ignored by Git. Preserve the existing database password and use the complete connection strings from your integration.

## 2. Check and create the application tables

From the VS Code PowerShell terminal:

```powershell
cd D:\YojanaSetu
$env:NODE_USE_SYSTEM_CA = "1"
npm.cmd run db:neon:check
npm.cmd run db:neon:setup -- --seed-demo
```

`NODE_USE_SYSTEM_CA` is needed on this Windows computer for its trusted certificate chain. It applies to the current terminal; run it again after opening another terminal if certificate verification fails. TLS verification remains enabled.

The setup command creates the isolated `yojanasetu` schema and tracks applied migrations. It leaves Neon's managed authentication schema alone. It is safe to run again. The `--seed-demo` option adds the 14 clearly labelled illustrative scheme records for testing; omit this flag for an empty catalogue. It does not create login accounts or administrators. Never run the Supabase migration files on Neon.

A connection check before setup can report that the database is reachable but application tables are missing. After setup, run the check again to confirm they exist.

## 3. Configure Neon Auth for the website

In Neon, open the project's branch and its **Auth** settings. Add the app origin to the allowed/trusted domains setting:

```text
http://127.0.0.1:3000
```

For deployment, also add the actual HTTPS website origin. Use the exact origin you open in the browser. Each preview branch must use the database and Auth URL belonging to that same branch. Keep email/password authentication enabled. Email confirmation and recovery depend on Neon Auth's email settings.

## 4. Run and check the app

```powershell
npm.cmd run dev
```

Open http://127.0.0.1:3000 and create an account with your own email. Follow the confirmation email if Neon requires it. Demo accounts do not transfer to Neon. Save a business profile, sign out, and sign back in: the profile should persist. Save a scheme, create an application checklist, and upload a PDF/PNG/JPEG smaller than 4 MB. Check that another account cannot see those saved records or download that file.

Private uploads are stored in the application database and returned only through an authenticated download route. They count against database storage. The 4 MB API cap fits Vercel's request-size limit. Account writes reject stale concurrent changes; reload the page and retry if another tab saved first.

To make your own registered account an administrator, run the following in Neon's SQL editor after logging in to the app at least once, replacing the example email:

```sql
update yojanasetu.users set role = 'admin' where email = 'your-email@example.com';
```

Only a database administrator should run this. Account signup cannot select administrator permissions.

## 5. Deploy to your existing Vercel project

In Vercel's **yojna-setu** project environment settings, check that the Neon integration supplies `DATABASE_URL` and `NEON_AUTH_BASE_URL`. Add `NEON_AUTH_COOKIE_SECRET` and set `NEXT_PUBLIC_SITE_URL` to the real HTTPS site origin. Set `DEMO_MODE=false`. Choose the corresponding Production, Preview, or Development environment deliberately. Use the same cookie secret across deployments of one environment; changing it invalidates signed session data.

Create the application schema on every database branch used for deployment. Migrations are an explicit setup step, not part of the build. Use Singapore (`sin1`) for Vercel Functions to match this database's region. Redeploy after updating environment variables. An existing deployment does not pick up new variables until rebuilt/redeployed.

Neon owns account authentication and recovery. Application enquiries are stored for administrator review. The existing Supabase email-delivery worker does not run on Neon; scheduled application reminder delivery needs a separate worker before email notifications can be offered.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The Neon SQL tests use a local PGlite database and do not send email or change the remote database. A passing local test does not replace the real signup/confirmation/persistence check in step 4.
