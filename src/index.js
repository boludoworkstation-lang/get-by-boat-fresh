import {getPublicSeoResponse} from './seo.js';

function protectResponse(response, request) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);

  // These restrictions do not interfere with Supabase OAuth or third-party maps.
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  headers.set('Permissions-Policy', 'camera=(), microphone=()');
  if (url.protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  }

  // The version parameter changes on every release, so these are safe to cache.
  // Do not give the same policy to unversioned HTML, images, or user content.
  if (/\.(?:css|js)$/.test(url.pathname) && url.searchParams.has('v') && response.ok) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const displayCurrencies = ['USD','AUD','BSD','ALL','TRY','PLN','HUF'];

async function displayExchangeRates() {
  try {
    const endpoint = 'https://api.frankfurter.dev/v2/rates?base=EUR&quotes=' + displayCurrencies.join(',');
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
      cf: {cacheEverything:true, cacheTtlByStatus:{'200-299':3600,'400-599':0}}
    });
    if (!response.ok) throw new Error('Exchange rates unavailable');
    const quotes = await response.json();
    const rates = Object.fromEntries(quotes
      .filter(row => row.base === 'EUR' && displayCurrencies.includes(row.quote) && Number.isFinite(row.rate) && row.rate > 0)
      .map(row => [row.quote, row.rate]));
    // The Bahamian dollar is pegged to the US dollar at parity.
    if (!rates.BSD && rates.USD) rates.BSD = rates.USD;
    return Response.json(rates, {headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
  } catch {
    return Response.json({}, {status:503, headers:{'Cache-Control':'no-store'}});
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/api/display-exchange-rates') {
      return protectResponse(await displayExchangeRates(), request);
    }
    const seoResponse = getPublicSeoResponse(request);
    if (seoResponse) return protectResponse(seoResponse, request);
    const assetResponse = await env.ASSETS.fetch(request);
    return protectResponse(assetResponse, request);
  },
};
