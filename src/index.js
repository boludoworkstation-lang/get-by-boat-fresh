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

export default {
  async fetch(request, env) {
    const seoResponse = getPublicSeoResponse(request);
    if (seoResponse) return protectResponse(seoResponse, request);
    const assetResponse = await env.ASSETS.fetch(request);
    return protectResponse(assetResponse, request);
  },
};
