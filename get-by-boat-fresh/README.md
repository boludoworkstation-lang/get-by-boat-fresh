# Get By Boat — simple Cloudflare Workers demo

This is a new, minimal project designed to deploy on Cloudflare Workers without R2, D1, Stripe, Hono, or a paid service.

## Features
- Responsive boat-rental landing page
- Search sample boats by destination and type
- Sample boat cards and demo request form
- Demo requests saved to the visitor's browser localStorage only
- `/api/health` endpoint

## Important limitations
This is a **prototype**, not a production marketplace. Listings are examples. Booking requests are **not sent to owners** and are **not stored on a server**. No accounts, payments, real inventory, owner dashboards, or image uploads are included. Photos are loaded from Unsplash and require internet access.

## GitHub upload (no terminal)
1. Create a **new empty GitHub repository** (recommended) or delete old project files in an existing repo before uploading.
2. Open the extracted `get-by-boat-fresh` folder on your computer.
3. Upload the CONTENTS of that folder (`wrangler.toml`, `package.json`, `src/`, `public/`, `README.md`) directly to the root of the GitHub repository. Do not upload the ZIP itself and do not nest an extra folder.
4. In Cloudflare Workers & Pages, create a Worker using GitHub integration and select the repository.
5. Set Root directory to repository root (blank or `/`, depending on UI). Build command: leave blank if allowed. Deploy command: `npx wrangler deploy`.
6. Deploy. The first deployment may ask you to configure a `workers.dev` subdomain.

## Deployment notes
- `wrangler.toml` configures the Worker entry point and static assets.
- `package.json` only installs Wrangler for deployment.
- There are no secrets or service bindings to create.
- To verify the Worker, visit `https://YOUR-URL/api/health` and look for `"ok":true`.

## Next steps for a real marketplace
Add proper authentication, D1 database, secure owner listing management, server-side booking requests and notifications, verified listings, and Stripe Connect/payment processing before accepting real customers. Never accept real payments using this demo.
