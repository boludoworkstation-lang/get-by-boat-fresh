// Authenticated, rate-limited check that the production Resend configuration works.
// Sends only to the signed-in user's confirmed email address. No booking or ID data.
const allowedOrigins = new Set(['https://getbyboat.net', 'https://www.getbyboat.net']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(body, status = 200, origin = '') {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      vary: 'Origin',
      ...(allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
      'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  });
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return reply({}, 204, origin);
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('GBB_FROM_EMAIL');
  if (!supabaseUrl || !anonKey || !serviceKey || !resendKey || !sender) {
    return reply({ error: 'Email service is not configured' }, 503, origin);
  }

  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return reply({ error: 'Sign-in required' }, 401, origin);

  try {
    const authResponse = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: { apikey: anonKey, authorization },
    });
    if (!authResponse.ok) return reply({ error: 'Authentication failed' }, 401, origin);
    const user = await authResponse.json();
    if (!uuid.test(user?.id || '') || !user?.email || !(user.email_confirmed_at || user.confirmed_at)) {
      return reply({ error: 'A confirmed email account is required' }, 403, origin);
    }

    // One email per account per UTC day, including when the same button is clicked repeatedly.
    const eventKey = 'self_test:' + user.id + ':' + new Date().toISOString().slice(0, 10);
    const adminHeaders = { apikey: serviceKey, authorization: 'Bearer ' + serviceKey };
    const prior = await fetch(supabaseUrl + '/rest/v1/booking_email_events?event_key=eq.' + encodeURIComponent(eventKey) + '&select=event_key', {
      headers: adminHeaders,
    });
    if (!prior.ok) return reply({ error: 'Unable to check test limit' }, 502, origin);
    if ((await prior.json()).length) return reply({ sent: false, reason: 'Test email already sent today' }, 200, origin);

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + resendKey,
        'content-type': 'application/json',
        'Idempotency-Key': eventKey,
      },
      body: JSON.stringify({
        from: sender,
        to: [user.email],
        subject: 'Get By Boat — email notification test',
        html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#173e4b"><h1 style="color:#008da6">Get By Boat</h1><h2>Email test successful</h2><p>Your Get By Boat email notifications are connected to Resend.</p><p>This is a test only. No booking was created, and no personal documents were accessed.</p></div>',
      }),
    });
    if (!send.ok) {
      console.error('Resend declined self-test email', send.status);
      return reply({ error: 'Resend did not accept the email; check Edge Function logs' }, 502, origin);
    }

    const recorded = await fetch(supabaseUrl + '/rest/v1/booking_email_events', {
      method: 'POST',
      headers: { ...adminHeaders, 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ event_key: eventKey, delivered_at: new Date().toISOString() }),
    });
    if (!recorded.ok) console.error('Resend accepted self-test but logging failed', recorded.status);
    return reply({ sent: true }, 200, origin);
  } catch (error) {
    console.error('Email self-test failed', error?.message || 'Unknown error');
    return reply({ error: 'Unable to send test email' }, 500, origin);
  }
});
