// Send a security notice only for a recently updated, authenticated account.
// Never accept an email address or identity from client input.
const origins=new Set(['https://getbyboat.net','https://www.getbyboat.net']);
function respond(body,status=200,origin=''){
 return new Response(status===204?null:JSON.stringify(body),{status,headers:{
  'content-type':'application/json','vary':'Origin',
  ...(origins.has(origin)?{'access-control-allow-origin':origin}:{}),
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  'access-control-allow-methods':'POST, OPTIONS'
 }});
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

Deno.serve(async request=>{
 const origin=request.headers.get('origin')||'';
 if(origin&&!origins.has(origin))return respond({error:'Origin not allowed'},403,origin);
 if(request.method==='OPTIONS')return respond({},204,origin);
 if(request.method!=='POST')return respond({error:'Method not allowed'},405,origin);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),
 service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),resend=Deno.env.get('RESEND_API_KEY'),
 from=Deno.env.get('GBB_FROM_EMAIL');
 if(!url||!anon||!service||!resend||!from)return respond({error:'Notification service is not configured'},503,origin);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(authorization))return respond({error:'Sign-in required'},401,origin);
 try{
  const identity=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,authorization}});
  if(!identity.ok)return respond({error:'Session expired'},401,origin);
  const user=await identity.json();
  if(!user?.id||!user?.email||(user.email_confirmed_at||user.confirmed_at)==null)
   return respond({error:'Confirmed email address required'},403,origin);
  const updated=Date.parse(user.updated_at||'');
  if(!Number.isFinite(updated)||Math.abs(Date.now()-updated)>120000)
   return respond({error:'No recent account update found'},409,origin);
  // One notice per exact auth update, even if the browser retries.
  const key='password_changed:'+user.id+':'+new Date(updated).toISOString();
  const admin={apikey:service,authorization:'Bearer '+service};
  const lookup=await fetch(url+'/rest/v1/booking_email_events?event_key=eq.'+encodeURIComponent(key)+'&select=event_key',{headers:admin});
  if(!lookup.ok)throw Error('Event lookup failed');
  if((await lookup.json()).length)return respond({sent:true,already_sent:true},200,origin);
  const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
   authorization:'Bearer '+resend,'content-type':'application/json','Idempotency-Key':key
  },body:JSON.stringify({
   from,to:[user.email],subject:'Get By Boat — your password was changed',
   html:brandedEmail('Your password was changed', '<p style="margin:0 0 14px">The password for your Get By Boat account has been successfully updated.</p><p style="margin:0 0 14px">If you made this change, no further action is needed.</p><p style="margin:0 0 14px">If this wasn\'t you, reset your password immediately or <a href="https://getbyboat.net/#/contact" style="color:#008fa5">contact support</a>.</p><p style="margin:0;color:#7b929a;font-size:13px">For your security, we never include passwords in emails.</p>', 'Go to Get By Boat', 'https://getbyboat.net/#/login')
  })});
  if(!mail.ok){console.error('Password email send rejected',mail.status);return respond({error:'Email delivery failed'},502,origin)}
  const save=await fetch(url+'/rest/v1/booking_email_events',{method:'POST',headers:{...admin,'content-type':'application/json',prefer:'resolution=ignore-duplicates'},body:JSON.stringify({event_key:key,delivered_at:new Date().toISOString()})});
  if(!save.ok)console.error('Password email accepted but log failed',save.status);
  return respond({sent:true},200,origin);
 }catch(error){console.error('Password security email failed',error?.message||error);return respond({error:'Unable to send notification'},500,origin)}
});