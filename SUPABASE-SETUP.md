# Go By Boat — connected booking foundation

Project: `oufkqqrhjuspczarzjrr` (Frankfurt). Public settings are in `dist/auth-config.js`; this contains only a publishable key.

## Implemented

- Email/password sign-up, sign-in, recovery and logout UI backed by Supabase Auth.
- Customer and owner profiles with row-level access restrictions.
- Owner boat creation/editing, draft/published visibility and photo uploads (5 MB JPEG/PNG/WebP).
- Owner availability blocks and date availability on real listings.
- Request-only reservations; owner acceptance/decline and customer cancellation.
- Inclusive rental days, 09:00–19:00 daily. Server computes prices and interpolated service fee capped at €149.
- Accepted requests hold dates. PostgreSQL exclusion constraint prevents overlapping accepted reservations, including concurrent transactions.
- No customer can mark a booking paid/confirmed; no Stripe payment flow is enabled.
- The live catalogue starts empty. Existing marketing/sample boat detail pages are examples and cannot submit real requests.

## Required before email signup testing

In https://supabase.com/dashboard/project/oufkqqrhjuspczarzjrr/auth/url-configuration:

1. Set Site URL to `https://get-by-boat-holiday.pj-scouting.chatgpt.site` while testing this private version.
2. Add `https://get-by-boat-holiday.pj-scouting.chatgpt.site/**` to redirect URLs.
3. When deploying on Cloudflare, add `https://get-by-boat-fresh.boludo-workstation.workers.dev/**` and set the primary Site URL to the public site.

In Authentication → Email → SMTP, configure your email sending provider. Default Supabase mail only sends to project team addresses and is not a customer email service. Do not disable email confirmation as a workaround. No SMTP credentials were available in this task. No real signup emails were sent during testing.

Google and Apple buttons are present on both login and signup. They check provider availability and start Supabase OAuth when enabled. Both providers currently require activation in Supabase; otherwise the form shows an explanatory message. After first social login, users complete the same customer/owner profile form. Booking event email notifications are not implemented; requests are visible in the dashboards (Refresh button).

## First owner / customer walkthrough

1. Create an account, confirm email, and select “Rent and list my boats” in My account.
2. Open Owner space → List a new boat; add details/photo and check Publish.
3. Add unavailable dates under Manage availability.
4. Use a separate customer account to view the live catalogue and submit a request.
5. As owner, accept or decline. As guest, check My requests or cancel.
6. An accepted request is **not a paid booking**. It holds dates indefinitely until the guest cancels; payment, owner cancellation rules and hold expiry still need to be implemented before commercial launch.

## Verification

`node --check dist/app.js`, `node --check dist/backend.js`, and `node tests/frontend.cjs` passed. Database `database/verify.sql` ran successfully inside a rolled-back transaction: server prices/status, profile and booking isolation, owner acceptance, inclusive date overlaps, payment bypass rejection, calendar blocks and cancellation.

Public REST smoke test: published boat read succeeded; anonymous bookings/profiles reads rejected. Security advisor reported no lints. An unused-index performance notice is expected for this empty project; retain the customer booking index.

Browser end-to-end signup, upload and layout checks were not completed because the preview browser infrastructure was unavailable. SMTP delivery and callback configuration remain unverified. This is a development foundation, not a launch-ready commercial booking service.

`database/schema.sql` documents the already-applied schema. Do not rerun it on the existing database. `database/verify.sql` is a rollback-only test, not a migration.

Source deployment here updates the private Sites version, not the original Cloudflare Workers deployment. Deploy the ZIP's `public/` assets using the existing Cloudflare project when ready.

## Google and Apple activation

Open Authentication → Sign In / Providers in the Supabase project. Configure Google with its Web OAuth client ID and secret; configure Apple with its Services ID and generated client secret. Keep these secrets in Supabase, never in frontend files. Register this provider callback:

`https://oufkqqrhjuspczarzjrr.supabase.co/auth/v1/callback`

Allow the site return URL `https://get-by-boat-holiday.pj-scouting.chatgpt.site/?auth_callback=1` in Supabase redirect settings (or the site wildcard described above).

Setup guides: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/social-login/auth-apple . Google/Apple developer credentials were not supplied and their OAuth login has not been tested end to end.
