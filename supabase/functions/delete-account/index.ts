// Get By Boat: server-side email verification before irreversible account deletion.
// Never trust a user ID or email supplied by the browser.
const allowedOrigins=new Set(['https://getbyboat.net','https://www.getbyboat.net']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function reply(data,status,origin){
 return new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','vary':'Origin',
  ...(allowedOrigins.has(origin)?{'access-control-allow-origin':origin}:{}),
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
  'access-control-allow-methods':'POST, OPTIONS'
 }});
}
const digest=async(input)=>{
 const bytes=new TextEncoder().encode(input);
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
};
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
 if(origin&&!allowedOrigins.has(origin))return reply({error:'Origin not allowed'},403,origin);
 if(request.method==='OPTIONS')return reply({},200,origin);
 if(request.method!=='POST')return reply({error:'Method not allowed'},405,origin);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),
   service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
   resend=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('GBB_FROM_EMAIL');
 if(!url||!anon||!service)return reply({error:'Account deletion service is not configured'},503,origin);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(authorization))return reply({error:'Please sign in'},401,origin);
 let body={};try{body=await request.json()}catch{return reply({error:'Invalid request'},400,origin)}
 if(!['request','confirm'].includes(body.action))return reply({error:'Invalid action'},400,origin);
 const headers={apikey:service,authorization:'Bearer '+service};
 const jsonHeaders={...headers,'content-type':'application/json'};
 try{
  const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,authorization}});
  if(!auth.ok)return reply({error:'Session expired. Please sign in again.'},401,origin);
  const user=await auth.json();
  if(!uuid.test(user.id||'')||!user.email||(user.email_confirmed_at||user.confirmed_at)==null)
   return reply({error:'A confirmed email address is required.'},403,origin);
  const query=url+'/rest/v1/account_deletion_challenges?user_id=eq.'+encodeURIComponent(user.id)+'&select=*';
  const priorResponse=await fetch(query,{headers});
  if(!priorResponse.ok)throw Error('Challenge lookup failed');
  const prior=(await priorResponse.json())[0];
  const now=Date.now();
  if(body.action==='request'){
   if(!resend||!from)return reply({error:'Email delivery is not configured'},503,origin);
   if(prior&&now-Date.parse(prior.sent_at)<60000)
    return reply({error:'Please wait 60 seconds before requesting another code.'},429,origin);
   const sameWindow=prior&&now-Date.parse(prior.window_started_at)<3600000;
   if(sameWindow&&prior.window_count>=5)
    return reply({error:'Too many codes requested. Please try again in one hour.'},429,origin);
   const random=new Uint32Array(1);crypto.getRandomValues(random);
   const code=String(random[0]%1000000).padStart(6,'0');
   const record={user_id:user.id,code_hash:await digest(service+':'+user.id+':'+code),
      expires_at:new Date(now+600000).toISOString(),sent_at:new Date(now).toISOString(),attempts:0,
      window_started_at:sameWindow?prior.window_started_at:new Date(now).toISOString(),
      window_count:sameWindow?prior.window_count+1:1};
   const saved=await fetch(url+'/rest/v1/account_deletion_challenges?on_conflict=user_id',{
    method:'POST',headers:{...jsonHeaders,prefer:'resolution=merge-duplicates'},body:JSON.stringify(record)});
   if(!saved.ok)throw Error('Challenge save failed');
   const email=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{authorization:'Bearer '+resend,'content-type':'application/json'},
    body:JSON.stringify({from,to:[user.email],subject:'Get By Boat — account deletion verification code',
      html:brandedEmail('Confirm account deletion', '<p style="margin:0 0 14px">Use this verification code to confirm your request to permanently delete your Get By Boat account.</p><div style="background:#eef8fa;border:1px solid #d7edf1;border-radius:10px;text-align:center;padding:21px 12px;margin:20px 0;font-size:32px;font-weight:800;letter-spacing:8px;color:#153c49">'+code+'</div><p style="margin:0 0 14px">This code expires in <strong>10 minutes</strong>.</p><p style="margin:0;color:#6d8791;font-size:13px">If you did not request account deletion, you can safely ignore this email.</p>')})
   });
   if(!email.ok){console.error('Resend account deletion email failed',email.status);
     return reply({error:'Email could not be delivered. Please try again later.'},502,origin);}
   return reply({sent:true},200,origin);
  }
  const code=String(body.code||'');
  if(!/^\d{6}$/.test(code))return reply({error:'Enter your 6-digit code.'},400,origin);
  if(!prior||now>=Date.parse(prior.expires_at))return reply({error:'Code expired. Request a new code.'},410,origin);
  if(prior.attempts>=5)return reply({error:'Too many incorrect attempts. Request a new code.'},429,origin);
  const updated=await fetch(query,{method:'PATCH',headers:jsonHeaders,body:JSON.stringify({attempts:prior.attempts+1})});
  if(!updated.ok)throw Error('Attempt update failed');
  const actual=await digest(service+':'+user.id+':'+code);
  if(actual!==prior.code_hash)return reply({error:'Incorrect code. Please try again.'},403,origin);
  // Fleet and booking data belong to other parties too. Never destroy them as a side effect.
  const own=await fetch(url+'/rest/v1/boats?owner_id=eq.'+encodeURIComponent(user.id)+'&select=id&limit=1',{headers});
  if(!own.ok)throw Error('Fleet lookup failed');
  if((await own.json()).length)return reply({error:'Remove or resolve your boat listings before deleting your account.'},409,origin);
  const bookings=await fetch(url+'/rest/v1/bookings?customer_id=eq.'+encodeURIComponent(user.id)+'&select=id,end_date,status,boat_id',{headers});
  if(!bookings.ok)throw Error('Booking lookup failed');
  const rows=await bookings.json();
  // Historical booking records still have required references: fail closed until archival is supported.
  if(rows.length)return reply({error:'Your account has reservation records. Deletion will be available once their safe archival is supported. No account data was removed.'},409,origin);
  const deleted=await fetch(url+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers});
  if(!deleted.ok){console.error('Auth user removal blocked',deleted.status);
   return reply({error:'Account deletion is blocked by linked documents or records. No account was removed.'},409,origin);}
  await fetch(query,{method:'DELETE',headers}).catch(()=>{});
  // Send the final receipt only after the auth provider confirms successful deletion.
  // Delivery failure cannot roll back a deleted account.
  let confirmationEmailSent=false;
  if(resend&&from&&user.email){
   try{
    const receipt=await fetch('https://api.resend.com/emails',{
     method:'POST',
     headers:{authorization:'Bearer '+resend,'content-type':'application/json',
      'Idempotency-Key':'account-deleted:'+user.id},
     body:JSON.stringify({
      from,to:[user.email],
      subject:'Get By Boat — your account has been deleted',
      html:brandedEmail('Your account has been deleted', '<p style="margin:0 0 14px">This confirms your Get By Boat account has been permanently deleted.</p><p style="margin:0 0 14px">You can no longer sign in using this account. If you did not request this action, please contact our support team immediately.</p><p style="margin:0;color:#7b929a;font-size:13px">Thank you for being part of Get By Boat.</p>'),
      text:'Your Get By Boat account has been permanently deleted. You can no longer sign in using this account. If you did not request this action, contact Get By Boat support immediately.'
     })
    });
    confirmationEmailSent=receipt.ok;
    if(!receipt.ok)console.error('Account deletion receipt email failed',receipt.status);
   }catch(emailError){console.error('Account deletion receipt email exception',emailError);}
  }else console.error('Account deletion receipt email is not configured');
  return reply({deleted:true,confirmation_email_sent:confirmationEmailSent},200,origin);
 }catch(error){console.error('Account deletion function error',error);
  return reply({error:'Account deletion is temporarily unavailable. Try again later.'},500,origin);}
});
