# Go By Boat — Image 1 Premium Marketplace Preview

A hand-crafted responsive frontend following the **first six-panel visual concept** approved in the chat:
- Scenic full-width yacht hero with search and eight destination cards
- Search-results page with filters and boat-list / map preview
- Boat-detail page with photo gallery and reservation form
- Customer login, booking preview and boat-owner dashboard
- Mediterranean Blue: `#00A8C6`

## IMPORTANT: what is NOT live
This is a **frontend demonstration**. The boats, owners, prices, bookings and ratings are sample data. No real identity authentication, owner listing storage, availability locks, charges, payouts, or customer payments exist. Booking and login forms clearly tell visitors they are demos. This ZIP is **not ready to accept real bookings or payments**.

## Project structure
- `public/index.html` — shell
- `public/styles.css` — complete responsive design
- `public/app.js` — sample data, navigation, search, filters and UI interactions
- `public/assets/` — bundled imagery, favicon; no external photo servers required
- `src/index.js` — Cloudflare Worker
- `wrangler.toml` — Worker name and static asset directory
- `package.json` — Wrangler setup

## Publish to your EXISTING Cloudflare project
The current GitHub repository is `boludoworkstation-lang/get-by-boat-fresh`, with the app inside the **nested `get-by-boat-fresh/` folder**. Cloudflare Builds **Root directory** should stay `get-by-boat-fresh` unless files are intentionally moved to the repo root.

1. Unzip this package.
2. In GitHub, navigate to `get-by-boat-fresh/get-by-boat-fresh/` (the INNER folder).
3. Upload the **contents** of this ZIP (not the outer folder and not the ZIP itself): `public`, `src`, `README.md`, `package.json`, `wrangler.toml`.
4. Commit and wait for the Cloudflare production build; deploy command `npx wrangler deploy`, build command blank.
5. Make sure old files from earlier versions that aren't in this ZIP don't override expected paths. Do not delete your project or change Cloudflare settings before confirming the status.

## Local check (optional)
`npm install`, `npm run check`, `npm run dev`. No npm setup is needed for the GitHub web-upload workflow.

## Scope and design
Only these countries are represented: Croatia, Greece, Spain, Italy, France, USA, Bahamas, Australia. No "Daily experiences" mode. Search is sample-data only. Photo assets are bundled with the package.

## Small search/filter changes (October 2026)
- Departure location now accepts typed city, island or country text. It filters the sample boats by their stored locations; it is not a worldwide geocoding service.
- Search boat categories: Motorboats, RIBs, Sailboats, Catamarans and Yachts. Not all categories have demo listings.
- Daily-price filter runs from EUR 50 to EUR 2,000+. The top setting does not exclude higher-priced boats.
- Instant booking checkbox filters illustrative sample boats only; actual booking, availability and instant confirmation are not active.
- The existing layout and other pages have been kept unchanged.

## Sidebar correction
The country-selector dropdown in the results sidebar has been removed. Customers type a location in the Departure location search field. Boat type, price and Instant booking filters remain intact.

## Equipment filter (preview)
The search filters include Water skis, Wakeboard, Towable Tube, Inflatable banana, Air Conditioning, Fridge, External speakers, Outdoor shower, Bimini, Autopilot, and GPS. You can select multiple items; demo boats must match all selected equipment. Equipment on sample boats is illustrative, not verified. When real owner listings are added, equipment must come from owner-provided verified inventory. No live bookings or payments are enabled.


## Boat length, engine power, and people filters
- Boat length: dual-handle filter from 0 m to 15+ m (15+ means no upper limit).
- Engine power: dual-handle filter from 0 hp to 400+ hp (400+ means no upper limit).
- Number of people replaces Guests in the search filter. Starts at 1, plus and minus adjust 1–12.
- Search results update on filter changes and Clear all restores defaults.
- Boat dimensions and power specifications are **illustrative demo data**, not owner-verified. Nothing about real boats or availability is guaranteed.

## Latest filter changes
Boat length (0–15+ metres), engine power (0–400+ horsepower), Number of people (1–12), and an ocean-blue Instant booking on/off switch. All filters work on illustrative sample boat specifications only; instant booking is not yet a live reservation feature.
