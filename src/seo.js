const BASE_URL = 'https://getbyboat.net';
const BOOKING_GUIDE_PATH = '/guides/how-boat-bookings-work';

// These answers describe the actual request-based flow. Keep visible copy and
// structured data in sync rather than writing search-engine-only claims.
const bookingQuestions = [
  {question:'What is Get By Boat?',answer:'Get By Boat is a boat-rental marketplace where travellers explore boats, compare rental details and send booking requests to boat owners.'},
  {question:'Are boat bookings instant?',answer:'No. Every booking is a request. The boat owner must review and approve a request before it can be confirmed.'},
  {question:'Can I rent a boat without a skipper?',answer:'Some listings offer self-drive rentals. For a self-drive rental, a traveller must have a verified ID or passport and a valid boat driving licence for the rental dates. Local rules and the boat owner’s conditions also apply.'},
  {question:'Can I request a boat with a skipper?',answer:'Yes, depending on the listing. A skipper may be included or offered as an optional extra. Any optional skipper price and payment arrangements are shown in the relevant listing and booking details.'},
  {question:'Do I pay when I send a booking request?',answer:'Sending a booking request does not itself charge a card. Payment is handled after owner approval when an online payment option is available; check the current booking flow for payment availability.'},
  {question:'How are boats listed on Get By Boat?',answer:'Boat owners register a business account, provide their business and identity verification information and create a listing. Owner verification is required before a listing can be published.'},
];

// Editorial destination pages are public, indexable entry points into the live
// marketplace. They never claim that a particular boat is available.
export const destinations = [
  {slug:'croatia',name:'Croatia',image:'destination-croatia.webp',places:['Split','Hvar','Dubrovnik','Zadar'],lead:'Island-hop along the Adriatic, from quiet coves to historic harbour towns.',detail:'Croatia is made for days on the water: discover sheltered bays, stone-built coastal towns and islands that feel worlds away from the shore.'},
  {slug:'greece',name:'Greece',image:'destination-greece.jpg',places:['Athens','Corfu','Mykonos','Rhodes'],lead:'Discover Greek islands, bright-blue bays and days shaped by the sea.',detail:'Explore the character of the Cyclades, the Ionian coastline or the islands closer to Athens. Choose a boat that suits the day you have in mind.'},
  {slug:'spain',name:'Spain',image:'destination-spain-blue-cove.jpg',places:['Ibiza','Mallorca','Barcelona','Málaga'],lead:'Find your stretch of Mediterranean sunshine, from the Balearics to the mainland.',detail:'Spain offers lively marinas, hidden calas and beautiful coastal scenery. Compare different boat types before planning your next escape.'},
  {slug:'france',name:'France',image:'destination-france.webp',places:['Nice','Cannes','Marseille','Saint-Tropez'],lead:'Experience the French coast from a completely different perspective.',detail:'From the Côte d’Azur to the calanques near Marseille, a day by boat opens up beaches, bays and new views of familiar destinations.'},
  {slug:'italy',name:'Italy',image:'destination-italy.jpg',places:['Amalfi Coast','Sardinia','Naples','Venice'],lead:'Explore Italian coastlines, island hideaways and unforgettable harbours.',detail:'Discover the dramatic Amalfi coastline, the blue waters around Sardinia or the quieter corners of Italy’s many seaside regions.'},
  {slug:'malta',name:'Malta',image:'home-speedboat.webp',places:['Valletta','Sliema','Gozo','Comino'],lead:'A compact island escape with exceptionally clear Mediterranean water.',detail:'Malta, Gozo and Comino offer rocky coves, sheltered swimming spots and short distances between memorable coastal experiences.'},
  {slug:'portugal',name:'Portugal',image:'destination-portugal.webp',places:['Lisbon','Lagos','Porto','Cascais'],lead:'See Portugal’s dramatic Atlantic coastline from the water.',detail:'From the cliffs and caves of the Algarve to the coast around Lisbon, Portugal rewards curious travellers who want to explore beyond the beach.'},
  {slug:'cyprus',name:'Cyprus',image:'hero-mediterranean.webp',places:['Limassol','Paphos','Larnaca','Ayia Napa'],lead:'Plan a sun-filled escape along the shores of Cyprus.',detail:'Discover clear-water bays, rugged stretches of coastline and relaxed seaside towns on a Mediterranean island known for its long summer season.'},
  {slug:'montenegro',name:'Montenegro',image:'hero-mediterranean.webp',places:['Kotor','Budva','Tivat','Herceg Novi'],lead:'Cruise where mountain scenery meets the Adriatic.',detail:'Montenegro combines the dramatic Bay of Kotor with an open coastline of beaches, inlets and picturesque seaside towns.'},
  {slug:'turkey',name:'Turkey',image:'hero-mediterranean.webp',places:['Bodrum','Marmaris','Fethiye','Göcek'],lead:'Find turquoise bays and beautiful cruising grounds along the Turkish Riviera.',detail:'The southwest coast of Turkey is dotted with islands, marinas and calm anchorages that invite you to slow down and explore.'},
  {slug:'albania',name:'Albania',image:'hero-mediterranean.webp',places:['Sarandë','Ksamil','Vlorë','Himarë'],lead:'Discover an Adriatic and Ionian coastline full of surprises.',detail:'Albania offers a mix of rocky headlands, clear-water beaches and emerging coastal destinations to explore at your own pace.'},
  {slug:'australia',name:'Australia',image:'destination-australia-whitsundays.webp',places:['Sydney','Gold Coast','Whitsundays','Perth'],lead:'From tropical islands to iconic harbours, Australia is best explored on the water.',detail:'Find a boat for a harbour outing, an island day or a memorable coastal escape. Experiences vary widely by region and season.'},
  {slug:'bahamas',name:'Bahamas',image:'destination-bahamas-speedboat.webp',places:['Nassau','Exuma','Paradise Island','Abaco'],lead:'Picture shallow turquoise seas, white sand and island horizons.',detail:'The Bahamas is a dream destination for relaxed days among cays and beaches. Explore boat options before choosing how you want to spend your time.'},
  {slug:'united-states',name:'United States',query:'USA',image:'destination-usa-miami.webp',places:['Miami','Key West','San Diego','Fort Lauderdale'],lead:'Find everything from sunny coastal outings to memorable days on the lake.',detail:'Across the United States, boating experiences change with the destination. Compare options for city skylines, open coastlines and lakeside escapes.'},
];

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const absolute = path => `${BASE_URL}${path}`;
const picture = place => absolute(`/assets/${place.image}`);
const searchLink = place => `/#/boats?country=${encodeURIComponent(place.query || place.name)}`;
const placeSearchLink = (place, city) => `/#/boats?location=${encodeURIComponent(`${city}, ${place.query || place.name}`)}`;

export function destinationHtml(place) {
  const canonical = absolute(`/destinations/${place.slug}`);
  const title = `Boat Rental in ${place.name} | Get By Boat`;
  const description = `${place.lead} Discover boat options and send a booking request on Get By Boat.`;
  const related = destinations.filter(item => item.slug !== place.slug).slice(0,7);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#006a83">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/assets/${escapeHtml(place.image)}" as="image" fetchpriority="high">
  <link rel="stylesheet" href="/destination-page.css?v=3">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Get By Boat">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${picture(place)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'WebPage',name:title,description,url:canonical,isPartOf:{'@type':'WebSite','@id':BASE_URL+'/#website'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Get By Boat',item:BASE_URL+'/'},{'@type':'ListItem',position:2,name:'Boat rental in '+place.name,item:canonical}]}]})}</script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><nav class="wrap" aria-label="Main navigation"><a class="wordmark" href="/">Get <span>By Boat</span></a><div><a href="/#/how-it-works">How it works</a><a class="nav-cta" href="/#/boats">Explore boats</a></div></nav></header>
  <main id="main">
    <section class="hero${place.slug==='spain'?' hero--spain':''}"><img src="/assets/${escapeHtml(place.image)}" alt="Coastal boating inspiration for ${escapeHtml(place.name)}" fetchpriority="high"><div class="hero-tint"></div><div class="wrap hero-content"><p class="eyebrow">GET BY BOAT · DESTINATIONS</p><h1>Boat rental in <em>${escapeHtml(place.name)}</em></h1><p class="hero-lead">${escapeHtml(place.lead)}</p><a class="button" href="${searchLink(place)}">Explore boats in ${escapeHtml(place.name)} <span aria-hidden="true">→</span></a></div></section>
    <section class="wrap intro"><div><p class="eyebrow dark">YOUR NEXT DAY AT SEA</p><h2>Discover the coast<br><em>your way.</em></h2></div><div><p>${escapeHtml(place.detail)}</p><p>Browse photographs, compare boat details and send a request to the owner. Availability and rental conditions are confirmed as part of the booking process.</p></div></section>
    <section class="places"><div class="wrap"><div class="section-heading"><h2>Places to explore</h2><p>Find inspiration for your departure point.</p></div><ul class="place-list">${place.places.map(name=>`<li><a href="${placeSearchLink(place,name)}" aria-label="Explore boats in ${escapeHtml(name)}, ${escapeHtml(place.name)}">${escapeHtml(name)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul><a class="text-link" href="${searchLink(place)}">See all boat options <span aria-hidden="true">→</span></a></div></section>
    <section class="wrap next"><div><p class="eyebrow dark">KEEP EXPLORING</p><h2>Another coast, another feeling.</h2><p class="guide-prompt">New to boat rental? <a href="${BOOKING_GUIDE_PATH}">Read how booking requests, skipper options and licence checks work.</a></p></div><nav class="related" aria-label="Other destinations">${related.map(item=>`<a href="/destinations/${item.slug}">${escapeHtml(item.name)} <span aria-hidden="true">↗</span></a>`).join('')}</nav></section>
    <section class="bottom-cta"><div class="wrap"><h2>The best memories have a little sea in them.</h2><a class="button light" href="${searchLink(place)}">Find your boat <span aria-hidden="true">→</span></a></div></section>
  </main>
  <footer class="site-footer"><div class="wrap"><a class="wordmark" href="/">Get <span>By Boat</span></a><p>Explore beautiful destinations. Request your next day on the water.</p><small>© 2026 Get By Boat</small></div></footer>
</body>
</html>`;
}

export function bookingGuideHtml() {
  const canonical = absolute(BOOKING_GUIDE_PATH);
  const title = 'How Boat Booking Requests Work | Get By Boat';
  const description = 'Learn how to rent a boat on Get By Boat: owner approval, self-drive licence checks, optional skippers and booking payment steps.';
  const faqSchema = bookingQuestions.map(({question,answer}) => ({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#006a83">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/destination-page.css?v=2">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Get By Boat">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${absolute('/assets/home-speedboat.webp')}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'FAQPage',url:canonical,mainEntity:faqSchema},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Get By Boat',item:BASE_URL+'/'},{'@type':'ListItem',position:2,name:'How booking requests work',item:canonical}]}]})}</script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><nav class="wrap" aria-label="Main navigation"><a class="wordmark" href="/">Get <span>By Boat</span></a><div><a href="/destinations/croatia">Destinations</a><a class="nav-cta" href="/#/boats">Explore boats</a></div></nav></header>
  <main id="main">
    <section class="guide-hero"><div class="wrap"><p class="eyebrow dark">GET BY BOAT · RENTAL GUIDE</p><h1>How boat booking <em>requests work.</em></h1><p class="guide-lead">Choose your destination, compare boats and request the day you want on the water. The owner reviews your request before a booking can be confirmed.</p><a class="button" href="/#/boats">Explore available boat listings <span aria-hidden="true">→</span></a></div></section>
    <section class="wrap guide-steps" aria-label="The booking process"><h2>From search to sea.</h2><ol><li><strong>Find a boat.</strong><p>Search by destination and dates. Compare photos, rental conditions, passenger capacity and skipper options.</p></li><li><strong>Send a request.</strong><p>Choose your rental dates and submit a booking request. This is not an instant confirmation.</p></li><li><strong>Wait for the owner.</strong><p>The owner reviews availability and accepts or declines the request. Any required identity or licence verification must be completed for self-drive rental.</p></li><li><strong>Review the next steps.</strong><p>Check the confirmed booking details, pickup information and available payment instructions before your day on the water.</p></li></ol></section>
    <section class="guide-faq"><div class="wrap"><p class="eyebrow dark">COMMON QUESTIONS</p><h2>Good to know before you go.</h2><div class="guide-faq-list">${bookingQuestions.map(({question,answer})=>`<section class="guide-qa"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></section>`).join('')}</div></div></section>
    <section class="wrap next"><p class="eyebrow dark">EXPLORE THE COAST</p><h2>Where would you like to go?</h2><nav class="related" aria-label="Explore boat rental destinations">${destinations.map(place=>`<a href="/destinations/${place.slug}">${escapeHtml(place.name)} <span aria-hidden="true">↗</span></a>`).join('')}</nav></section>
    <section class="bottom-cta"><div class="wrap"><h2>Make your next day count.</h2><a class="button light" href="/#/boats">Find your boat <span aria-hidden="true">→</span></a></div></section>
  </main>
  <footer class="site-footer"><div class="wrap"><a class="wordmark" href="/">Get <span>By Boat</span></a><p>Explore beautiful destinations. Request your next day on the water.</p><small>© 2026 Get By Boat</small></div></footer>
</body>
</html>`;
}

export function robotsTxt() {
  // No crawlable account, booking, or document URLs are exposed here. Hash-based
  // application routes are not distinct HTTP paths for search engines.
  return `User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Claude-SearchBot\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Bingbot\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`;
}

export function sitemapXml() {
  const urls = [BASE_URL+'/', absolute(BOOKING_GUIDE_PATH), ...destinations.map(place=>absolute(`/destinations/${place.slug}`))];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(url=>`  <url><loc>${url}</loc></url>`).join('\n')+'\n</urlset>';
}

export function getPublicSeoResponse(request) {
  const url = new URL(request.url);
  const isPublicPage = ['/sitemap.xml','/robots.txt',BOOKING_GUIDE_PATH,BOOKING_GUIDE_PATH+'/'].includes(url.pathname) || /^\/destinations\/[a-z-]+\/?$/.test(url.pathname);
  if (isPublicPage && !['GET','HEAD'].includes(request.method)) {
    return new Response('Method not allowed', {status:405,headers:{'Allow':'GET, HEAD'}});
  }
  if (url.pathname === '/sitemap.xml') {
    return new Response(sitemapXml(), {headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
  }
  if (url.pathname === '/robots.txt') {
    return new Response(robotsTxt(), {headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
  }
  if (url.pathname === BOOKING_GUIDE_PATH+'/') return Response.redirect(absolute(BOOKING_GUIDE_PATH),301);
  if (url.pathname === BOOKING_GUIDE_PATH) {
    return new Response(bookingGuideHtml(), {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=3600'}});
  }
  const match = /^\/destinations\/([a-z-]+)\/?$/.exec(url.pathname);
  if (!match) return null;
  const place = destinations.find(item => item.slug === match[1]);
  if (!place) return new Response('Destination not found', {status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  if (url.pathname.endsWith('/')) return Response.redirect(absolute(`/destinations/${place.slug}`),301);
  return new Response(destinationHtml(place), {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
