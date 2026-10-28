# Go By Boat — verified frontend preview

**This is NOT a functioning payment or booking marketplace.** It is a frontend preview with sample listings and preview-only owner/customer dialogs. No user data is collected and no payments occur.

## GitHub / Cloudflare deployment (no terminal)

The ZIP contains files **at its root**: `package.json`, `wrangler.toml`, `src/`, `public/`. Upload these files and folders directly to the ROOT of a new GitHub repository, **not inside another folder**.

Connect the repository to Cloudflare Workers. Use these settings:

- Root directory: `/` or leave blank (for a repository with files at root).
- Build command: `npm install` (or Cloudflare's automatic dependency installation).
- Deploy command: `npx wrangler deploy`.
- Worker name: `get-by-boat-fresh` in `wrangler.toml`. If your Cloudflare Worker has another name, update this setting before deployment.

The site requires no D1, R2, secrets or Stripe keys. Static files are served using Cloudflare Workers Assets. The website uses external Unsplash example images, which depend on internet availability and should be replaced by properly licensed originals before production launch.

## Verified functionality

- Country selector (Croatia, Greece, Spain, Italy, France, USA, Bahamas, Australia), boat type filters, sample boat cards, country shortcuts.
- Basic date ordering validation. Dates do not filter real availability.
- Login, owner and boat dialogs clearly identify their **preview-only** status.
- No Daily Experiences feature.

## Not implemented yet

Real customer authentication, guest checkout, owner portal, payments, database, availability calendar, owner payouts, messaging and booking confirmations.
