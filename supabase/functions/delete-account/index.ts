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
      html:'<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:30px;color:#173e4b"><h2>Confirm account deletion</h2><p>Enter this code on Get By Boat to confirm your request:</p><p style="font-size:30px;font-weight:800;letter-spacing:8px">'+code+'</p><p>This code expires in 10 minutes. If you did not request account deletion, ignore this email.</p></div>'})
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
      html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#173e4b"><h1 style="color:#008da6">Get By Boat</h1><h2>Your account has been deleted</h2><p>This email confirms that your Get By Boat account was permanently deleted.</p><p>You can no longer sign in using this account. If you did not request this action, please contact our support team immediately.</p><p style="color:#69818a;font-size:13px">Thank you for being part of Get By Boat.</p></div>',
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
