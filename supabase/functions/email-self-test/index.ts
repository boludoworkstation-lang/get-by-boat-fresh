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


// Shared, email-client-safe Get By Boat transactional design.
function brandedEmail(title, content, actionLabel = '', actionUrl = '') {
  const action = actionLabel && actionUrl
    ? '<tr><td style="padding:8px 36px 24px"><a href="' + actionUrl + '" style="display:inline-block;background:#008fa5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:20px;padding:13px 23px;border-radius:9px">' + actionLabel + '</a></td></tr>'
    : '';
  return '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;background:#f2f7f8;font-family:Arial,Helvetica,sans-serif;color:#153c49">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2f7f8"><tr><td align="center" style="padding:38px 14px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e1ecef;border-radius:16px;overflow:hidden">' +
    '<tr><td style="height:6px;background:#008fa5;font-size:0;line-height:0">&nbsp;</td></tr>' +
    '<tr><td style="padding:31px 36px 12px"><a href="https://getbyboat.net/" style="text-decoration:none;color:#008fa5;font-size:23px;font-weight:800;letter-spacing:-.6px">Get By Boat</a></td></tr>' +
    '<tr><td style="padding:10px 36px 0"><h1 style="font-size:25px;line-height:32px;letter-spacing:-.6px;font-weight:750;margin:0 0 14px;color:#153c49">' + title + '</h1></td></tr>' +
    '<tr><td style="padding:0 36px 15px;font-size:15px;line-height:24px;color:#425d68">' + content + '</td></tr>' +
    action +
    '<tr><td style="padding:0 36px 30px"><div style="border-top:1px solid #e7eff1;padding-top:18px;color:#7b929a;font-size:12px;line-height:19px">This is an automated message from Get By Boat.<br>Need help? <a href="https://getbyboat.net/#/contact" style="color:#008fa5;text-decoration:underline">Contact support</a>.</div></td></tr>' +
    '</table><div style="font-size:12px;color:#93a6ad;line-height:19px;padding:19px 12px;text-align:center">Get By Boat &middot; Your next holiday starts at sea.<br><a href="https://getbyboat.net/" style="color:#7896a1;text-decoration:none">getbyboat.net</a></div>' +
    '</td></tr></table></body></html>';
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
        html: brandedEmail('Email test successful', '<p style="margin:0 0 14px">Your Get By Boat email notifications are connected to Resend.</p><p style="margin:0">This is a test only. No booking was created, and no personal documents were accessed.</p>'),
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
