# Get By Boat — Cloudflare upload package

## Upload to your existing GitHub repository

1. Extract this ZIP. Upload its contents to the TOP LEVEL of `boludoworkstation-lang/get-by-boat-fresh`.
2. Replace the existing root `public`, `src`, `package.json`, `package-lock.json` and `wrangler.toml` files with the files in this package. Do not upload the ZIP itself and do not place the contents inside another `get-by-boat-fresh` subfolder.
3. At repository root you should see `public/`, `src/`, `database/`, `tests/`, `package.json`, `package-lock.json`, `wrangler.toml` and this README.
4. Cloudflare → your existing Worker → Settings → Build:
   - Production branch: `main`
   - Root directory: EMPTY (repository root)
   - Build command: EMPTY
   - Deploy command: `npx wrangler deploy`
5. Save settings. Commit the upload on GitHub. Check the resulting build is Ready. If it does not start, trigger a new build of the latest commit.
6. Open the website in a private window. The title must say Get By Boat; Log in and List your boat should open the centered dialogs.

The Worker name remains `get-by-boat-fresh` to update the existing deployment and preserve its domain association. Old unrelated folders already in GitHub are not used when Root directory is empty. No deletion is necessary to deploy this package.

## What is connected

- Public Supabase project configuration, email/password auth integration, account profiles.
- Owner listing creation/editing, photo upload and publication.
- Calendar blocks, customer requests, owner acceptance/decline and cancellation.
- Server-calculated daily prices and service fee; inclusive dates, 09:00–19:00 daily.
- Google and Apple OAuth buttons with clear availability feedback.

The catalogue is empty until owners add published boats. Sample marketing boat pages cannot submit real requests.

## Required external setup — not fixed by uploading a ZIP

- Supabase Authentication URL configuration must allow your actual domain. If using `https://go-by-boat.com`, set that as Site URL and add `https://go-by-boat.com/**` as an allowed redirect URL. This package uses the current browser origin for login callbacks.
- Configure custom SMTP in Supabase for customer confirmation and password reset emails. Default Supabase email is restricted to project team members.
- Enable Google and Apple with your developer application credentials in Supabase. Their callback is `https://oufkqqrhjuspczarzjrr.supabase.co/auth/v1/callback`. Never put provider secrets in public JavaScript.
- Stripe and booking notification emails are NOT connected. Accepted requests hold dates but are not paid confirmations. Accepted holds do not expire automatically yet.
- Privacy and terms pages remain drafts. This package is not a fully launched commercial booking service.

Existing Supabase project: `oufkqqrhjuspczarzjrr`. `database/schema.sql` is a record of the ALREADY APPLIED schema, not a script to run again. `database/verify.sql` is a rollback-only test.

## Verification

Run `npm ci --ignore-scripts` then `npm run check`. Tests cover routing, customer/owner access UI, request payload and Google/Apple availability handling. Real end-to-end Google/Apple login, email delivery and Stripe payments have not been tested because those providers are not configured. Browser visual testing was unavailable in this environment.

Package validation: Wrangler 4.154.0 `deploy --dry-run` completed successfully, reading 25 public assets and resolving the ASSETS binding. No deployment was performed by this check.
