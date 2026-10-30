// Transactional notifications for booking participants only.
// Secrets must be configured in Supabase: RESEND_API_KEY and GBB_FROM_EMAIL.
// No message text, IDs/passports, boat-licence files or document URLs leave Supabase.
const allowedOrigins = new Set(['https://getbyboat.net', 'https://www.getbyboat.net']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const eventTypes = new Set(['booking_created', 'owner_accepted', 'owner_declined', 'message']);

function reply(body, status = 200, origin = '') {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: {
    'content-type': 'application/json',
    'vary': 'Origin',
    ...(allowedOrigins.has(origin) ? {'access-control-allow-origin': origin} : {}),
    'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS'
  }});
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin)) return reply({error:'Origin not allowed'}, 403);
  if (request.method === 'OPTIONS') return reply({}, 204, origin);
  if (request.method !== 'POST') return reply({error:'Method not allowed'}, 405, origin);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('GBB_FROM_EMAIL');
  if (!serviceKey || !supabaseUrl || !anonKey) return reply({error:'Service configuration unavailable'}, 503, origin);
  if (!resendKey || !sender) return reply({error:'Email notifications are awaiting domain verification and Resend configuration'}, 503, origin);
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return reply({error:'Sign-in required'}, 401, origin);
  try {
    if ((Number(request.headers.get('content-length')) || 0) > 4096) return reply({error:'Request too large'}, 413, origin);
    const body = await request.json();
    const bookingId = body?.booking_id;
    const eventType = body?.event_type;
    const messageId = body?.message_id;
    if (!uuid.test(String(bookingId)) || !eventTypes.has(eventType) || (eventType === 'message' && !uuid.test(String(messageId)))) return reply({error:'Invalid notification request'}, 400, origin);

    const authResponse = await fetch(supabaseUrl+'/auth/v1/user', {headers:{apikey:anonKey,authorization}});
    if (!authResponse.ok) return reply({error:'Authentication failed'}, 401, origin);
    const actor = await authResponse.json();
    if (!uuid.test(actor?.id||'')) return reply({error:'Authentication failed'}, 401, origin);
    const adminHeaders = {apikey:serviceKey, authorization:'Bearer '+serviceKey};
    const adminFetch = (path, opts={}) => fetch(supabaseUrl+path, { ...opts, headers:{...adminHeaders,...(opts.headers||{})} });
    const bookingResponse = await adminFetch('/rest/v1/bookings?select=id,customer_id,status,boats(name,owner_id)&id=eq.'+bookingId+'&limit=1');
    if (!bookingResponse.ok) return reply({error:'Could not load booking'}, 502, origin);
    const booking = (await bookingResponse.json())[0];
    if (!booking || !booking.boats) return reply({error:'Booking not found'}, 404, origin);
    const isCustomer = actor.id === booking.customer_id;
    const isOwner = actor.id === booking.boats.owner_id;
    if (!isCustomer && !isOwner) return reply({error:'Access denied'}, 403, origin);
    if (eventType === 'booking_created' && (!isCustomer || booking.status !== 'pending_owner')) return reply({error:'Invalid booking event'}, 403, origin);
    if (eventType === 'owner_accepted' && (!isOwner || booking.status !== 'awaiting_payment')) return reply({error:'Invalid owner event'}, 403, origin);
    if (eventType === 'owner_declined' && (!isOwner || booking.status !== 'declined')) return reply({error:'Invalid owner event'}, 403, origin);
    if (eventType === 'message') {
      const msgResponse = await adminFetch('/rest/v1/booking_messages?select=id,booking_id,sender_id&booking_id=eq.'+bookingId+'&id=eq.'+messageId+'&limit=1');
      if (!msgResponse.ok) return reply({error:'Could not load message'}, 502, origin);
      const message = (await msgResponse.json())[0];
      if (!message || message.sender_id !== actor.id || !['pending_owner','awaiting_payment','confirmed'].includes(booking.status)) return reply({error:'Invalid message event'}, 403, origin);
    }

    const recipientId = eventType === 'booking_created' ? booking.boats.owner_id
      : eventType === 'message' ? (isCustomer ? booking.boats.owner_id : booking.customer_id)
      : booking.customer_id;
    if (recipientId === actor.id) return reply({sent:false,reason:'Self notification skipped'}, 200, origin);
    const eventKey = (eventType === 'message' ? 'message:'+messageId : eventType+':'+bookingId);
    const query = '/rest/v1/booking_email_events?event_key=eq.'+encodeURIComponent(eventKey)+'&select=event_key';
    const prior = await adminFetch(query);
    if (!prior.ok) return reply({error:'Notification state unavailable'}, 502, origin);
    if ((await prior.json()).length) return reply({sent:false,reason:'Already notified'}, 200, origin);

    const userResponse = await adminFetch('/auth/v1/admin/users/'+recipientId);
    if (!userResponse.ok) return reply({error:'Recipient unavailable'}, 502, origin);
    const recipient = (await userResponse.json())?.email;
    if (!recipient) return reply({sent:false,reason:'Recipient has no email'}, 200, origin);
    const descriptions = {
      booking_created:'You have a new booking request.',
      owner_accepted:'Your booking request has been accepted. Payment is not connected yet.',
      owner_declined:'Your booking request has been declined.',
      message:'You have a new private message about your booking.'
    };
    const headline = descriptions[eventType];
    const url = 'https://getbyboat.net/#/messages?booking='+bookingId;
    const html = '<div style="font-family:Arial,sans-serif;color:#173e4b;max-width:580px;margin:auto;padding:32px"><h1 style="color:#008da6">Get By Boat</h1><h2>'+escapeHtml(headline)+'</h2><p>Boat: <strong>'+escapeHtml(booking.boats.name)+'</strong></p><p>Sign in to see the booking and conversation.</p><p><a href="'+url+'" style="background:#008da6;color:white;text-decoration:none;padding:12px 18px;border-radius:6px;display:inline-block">View booking</a></p><p style="font-size:12px;color:#637b84">This is an automated booking update. No identity documents or private messages are included.</p></div>';
    const send = await fetch('https://api.resend.com/emails', {method:'POST',headers:{authorization:'Bearer '+resendKey,'content-type':'application/json','Idempotency-Key':eventKey},body:JSON.stringify({from:sender,to:[recipient],subject:'Get By Boat — '+headline,html})});
    if (!send.ok) {
      // Avoid recording the event as delivered; it can be retried after configuration is fixed.
      console.error('Email provider rejected notification', send.status);
      return reply({error:'Notification delivery unavailable'}, 502, origin);
    }
    const record = await adminFetch('/rest/v1/booking_email_events', {method:'POST',headers:{'content-type':'application/json',prefer:'resolution=ignore-duplicates'},body:JSON.stringify({event_key:eventKey,delivered_at:new Date().toISOString()})});
    if (!record.ok) console.error('Email delivered but event log write failed',record.status);
    return reply({sent:true}, 200, origin);
  } catch (error) {
    console.error('Booking email failed',error?.message||'Unknown error');
    return reply({error:'Unable to process notification'}, 500, origin);
  }
});
