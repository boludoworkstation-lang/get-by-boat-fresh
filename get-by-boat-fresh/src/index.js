// Minimal Cloudflare Worker: no database, billing, or external packages required.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, app: 'Get By Boat', mode: 'demo' });
    }
    return env.ASSETS.fetch(request);
  }
};
