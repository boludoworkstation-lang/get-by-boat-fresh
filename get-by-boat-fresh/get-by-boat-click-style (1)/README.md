# Get By Boat — Mediterranean marketplace frontend

This is a **visual and interactive frontend preview**, inspired by the structure of boat charter marketplace websites, with original Get By Boat branding and `#00A8C6` Mediterranean blue buttons. It is not yet a live booking business.

Included:
- Large Mediterranean sea image generated for this project (stored locally)
- Left-aligned white homepage booking search panel, responsive mobile layout
- Location, date and boat-type inputs; sample search/filter/sort
- Exactly eight supported countries: Croatia, Greece, Spain, Italy, France, USA, Bahamas and Australia
- Example boat cards and detail views
- Guest booking request preview saved only to the visitor's browser
- Account login/signup UI mock, owner dashboard UI mock
- No “Daily experiences” option

Not yet functional: live customer or owner authentication, owner-submitted listings, database, calendar conflict prevention, real bookings, payment checkout, Stripe Connect payouts, tax/legal compliance. Do not accept payments or real reservations until these have been implemented and security tested. Example images are linked from Unsplash and require internet connectivity.

## Install in the existing repo (important)

The GitHub repository has an existing nested folder named `get-by-boat-fresh`. Cloudflare is configured to use that as the Root directory. **Replace the files INSIDE that nested folder**, not in the repository top-level and not in an extra folder.

Files that should be at `get-by-boat-fresh/`:

- `wrangler.toml`
- `package.json`
- `README.md`
- `src/index.js`
- `public/index.html`
- `public/style.css`
- `public/app.js`
- `public/assets/mediterranean-sea.jpg`

Cloudflare build configuration:
- Root directory: `get-by-boat-fresh`
- Build command: empty
- Deploy command: `npx wrangler deploy`

Deploy must be checked from Cloudflare dashboard. This package is locally verified only, and real Cloudflare deployment cannot be guaranteed without executing a build in the connected environment.
