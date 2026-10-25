// Cloudflare Worker: serve the static Get By Boat frontend via Workers Assets.
// No D1, R2, Stripe keys, or external service bindings are required for this preview.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
