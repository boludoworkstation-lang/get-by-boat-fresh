const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/email-self-test/index.ts'), 'utf8');
const project = 'https://example.supabase.co';
const origin = 'https://getbyboat.net';
const userId = '11111111-1111-4111-8111-111111111111';
let confirmed = true, providerWorks = true, stored = false, emails = 0;
let sentPayload;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

const env = {
  SUPABASE_URL: project,
  SUPABASE_ANON_KEY: 'anon-for-test',
  SUPABASE_SERVICE_ROLE_KEY: 'server-for-test',
  RESEND_API_KEY: 're_test',
  GBB_FROM_EMAIL: 'Get By Boat <notifications@getbyboat.net>',
};

let handler;
vm.runInNewContext(source, {
  Deno: {
    env: { get: name => env[name] },
    serve: fn => { handler = fn; },
  },
  fetch: async (url, opts = {}) => {
    if (url === project + '/auth/v1/user') {
      return json({ id: userId, email: 'signed-in@example.com', email_confirmed_at: confirmed ? '2026-10-30T08:00:00Z' : null, confirmed_at: null });
    }
    if (url.includes('/rest/v1/booking_email_events')) {
      if (opts.method === 'POST') { stored = true; return json({}, 201); }
      return json(stored ? [{ event_key: 'already-sent' }] : []);
    }
    if (url === 'https://api.resend.com/emails') {
      emails++;
      sentPayload = JSON.parse(opts.body);
      return providerWorks ? json({ id: 'resend-message-id' }) : json({ error: 'provider down' }, 500);
    }
    throw Error('Unexpected fetch: ' + url);
  },
  Response,
  URL,
  Date,
  console: { error() {} },
  encodeURIComponent,
});

const request = (method, token, requestOrigin = origin, body = {}) => new Request(project + '/functions/v1/email-self-test', {
  method,
  headers: { origin: requestOrigin, ...(token ? { authorization: 'Bearer ' + token } : {}) },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});

(async () => {
  assert.equal((await handler(request('OPTIONS'))).status, 204);
  assert.equal((await handler(request('GET'))).status, 405);
  assert.equal((await handler(request('POST'))).status, 401);
  assert.equal((await handler(request('POST', 'token', 'https://evil.example'))).status, 403);
  confirmed = false;
  assert.equal((await handler(request('POST', 'token'))).status, 403);
  assert.equal(emails, 0);

  confirmed = true;
  const sent = await handler(request('POST', 'token', origin, { to: 'attacker@example.com' }));
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).sent, true);
  assert.deepEqual(sentPayload.to, ['signed-in@example.com']);
  assert.equal(emails, 1);

  const duplicate = await handler(request('POST', 'token'));
  assert.equal((await duplicate.json()).sent, false);
  assert.equal(emails, 1);

  stored = false;
  providerWorks = false;
  const failed = await handler(request('POST', 'token'));
  assert.equal(failed.status, 502);
  assert.equal(stored, false);
  console.log('email-self-test: authentication, destination, rate limit, and provider failure passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
