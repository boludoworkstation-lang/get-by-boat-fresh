const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const repo = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repo, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'public/app.js'), 'utf8');
const workflow = fs.readFileSync(path.join(repo, '.github/workflows/deploy-worker.yml'), 'utf8');

(async () => {
  const {default:worker} = await import('../src/index.js');
  const {destinations,bookingGuideHtml} = await import('../src/seo.js');
  const env = {ASSETS:{fetch:async()=>new Response('asset body',{headers:{'content-type':'text/css','cache-control':'public, max-age=0, must-revalidate'}})}};

  const sitemap = await worker.fetch(new Request('https://getbyboat.net/sitemap.xml'), env);
  const xml = await sitemap.text();
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type'), /application\/xml/);
  assert.match(xml, /https:\/\/getbyboat\.net\/destinations\/croatia/);
  assert.equal((xml.match(/<url>/g)||[]).length, destinations.length + 2);
  assert.match(xml, /https:\/\/getbyboat\.net\/guides\/how-boat-bookings-work/);

  const robots = await worker.fetch(new Request('https://getbyboat.net/robots.txt'),env);
  const robotsText = await robots.text();
  assert.equal(robots.status,200);
  assert.match(robots.headers.get('content-type'), /text\/plain/);
  assert.match(robotsText,/User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(robotsText,/User-agent: Claude-SearchBot\nAllow: \//);
  assert.match(robotsText,/User-agent: PerplexityBot\nAllow: \//);
  assert.match(robotsText,/Sitemap: https:\/\/getbyboat\.net\/sitemap\.xml/);

  for (const destination of destinations) {
    const response = await worker.fetch(new Request('https://getbyboat.net/destinations/'+destination.slug), env);
    const page = await response.text();
    assert.equal(response.status, 200, destination.name);
    assert.match(page, new RegExp(`<h1>Boat rental in <em>${destination.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}<\\/em>`));
    assert.ok(page.includes(`rel="canonical" href="https://getbyboat.net/destinations/${destination.slug}"`));
    assert.ok(page.includes(`/#/boats?country=${encodeURIComponent(destination.query || destination.name)}`));
    assert.ok(page.includes('property="og:image"'));
    assert.match(page, /"@type":"BreadcrumbList"/);
    assert.match(page, /aria-label="Explore boats in /);
    assert.match(page, /guides\/how-boat-bookings-work/);
    assert.ok(!page.includes('342,507'));
  }

  const guideResponse = await worker.fetch(new Request('https://getbyboat.net/guides/how-boat-bookings-work'),env);
  const guide = await guideResponse.text();
  assert.equal(guideResponse.status,200);
  assert.match(guide,/<h1>How boat booking <em>requests work\.<\/em><\/h1>/);
  assert.match(guide,/"@type":"FAQPage"/);
  assert.match(guide,/Are boat bookings instant\?/);
  assert.match(guide,/must review and approve/);
  assert.equal(bookingGuideHtml(),guide);
  const guideRedirect = await worker.fetch(new Request('https://getbyboat.net/guides/how-boat-bookings-work/'),env);
  assert.equal(guideRedirect.status,301);

  const notFound = await worker.fetch(new Request('https://getbyboat.net/destinations/unknown'), env);
  assert.equal(notFound.status, 404);
  const noPost = await worker.fetch(new Request('https://getbyboat.net/sitemap.xml', {method:'POST'}), env);
  assert.equal(noPost.status, 405);
  const noPostRobots = await worker.fetch(new Request('https://getbyboat.net/robots.txt', {method:'POST'}),env);
  assert.equal(noPostRobots.status,405);
  const redirect = await worker.fetch(new Request('https://getbyboat.net/destinations/croatia/'), env);
  assert.equal(redirect.status, 301);

  const versioned = await worker.fetch(new Request('https://getbyboat.net/styles.css?v=1'), env);
  assert.equal(versioned.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(versioned.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(versioned.headers.get('x-frame-options'), 'DENY');
  assert.equal(versioned.headers.get('strict-transport-security'), 'max-age=31536000');
  assert.match(versioned.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const unversioned = await worker.fetch(new Request('https://getbyboat.net/styles.css'), env);
  assert.equal(unversioned.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  const head = await worker.fetch(new Request('https://getbyboat.net/styles.css?v=1',{method:'HEAD'}), env);
  assert.equal(await head.text(), '');

  assert.match(html, /rel="canonical" href="https:\/\/getbyboat.net\/"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /class="preboot"/);
  assert.match(html,/"@type":"Organization"/);
  assert.match(html,/"@type":"WebSite"/);
  const homeJsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(homeJsonLd);
  assert.equal(JSON.parse(homeJsonLd[1])['@graph'].length,2);
  assert.match(app, /aria-label="Popular destinations"/);
  assert.doesNotMatch(app, /FOOTER_COUNTER_BASE/);
  assert.match(app, /data-member-count>342,507<\/strong>/);
  assert.match(app, /Internal reference counter, not a verified user count/);
  assert.doesNotMatch(workflow, /appendFileSync\('public\/app\.js'/);
  console.log('PASS: indexable destination pages, sitemap, social metadata, safe cache headers, truthful homepage and one-copy frontend.');
})().catch(error => {console.error(error); process.exitCode=1});
