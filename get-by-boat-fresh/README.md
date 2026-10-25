# Get By Boat — premium visual concept

A responsive, editorial-style boat marketplace **frontend preview** for Croatia, Greece, Spain, Italy, France, USA, Bahamas and Australia.

## What's included
- Homepage with luxury hero, sea photography, search card, destinations and boats
- Search by destination and boat type, dates UI and simple date validation
- Boat cards, detail previews, guest checkout UI, customer login UI, owner dashboard UI
- Mediterranean Blue (#00A8C6) buttons, responsive mobile design

## Important limits
- This is a **frontend design concept**, NOT a working marketplace.
- Boats and prices are fictional sample content.
- Accounts, owner listing persistence, bookings, inventory, payments and payouts are NOT connected. No charges are possible.
- Images and fonts are fetched from third-party CDN services at runtime and require internet access; replace with properly licensed hosted assets before production.
- Dates are collected for search UI but availability is NOT verified.

## Cloudflare Workers
`wrangler.toml` uses a Worker with static assets. `src/index.js` delegates requests to the ASSETS binding.

For Git-connected deployments set Root directory to the folder containing `wrangler.toml` and `public/`, build command blank, deploy command `npx wrangler deploy`.

The Worker name in wrangler.toml is `get-by-boat-fresh` for compatibility with the existing project; change if deploying a separate Worker.

## Uploading to existing GitHub repo
Upload the contents of this ZIP **inside the existing nested `get-by-boat-fresh/` folder**, replacing the old `src/index.js`, `public/` files, `wrangler.toml`, `package.json` and README. GitHub's web upload may not remove old files; remove unused old assets manually after confirming the new version works. Verify the upload destination before committing.
