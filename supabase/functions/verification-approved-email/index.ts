const allowedOrigins=new Set(['https://getbyboat.net','https://www.getbyboat.net']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(body,status=200,origin='')=>new Response(status===204?null:JSON.stringify(body),{
 status,headers:{'content-type':'application/json','vary':'Origin',
 ...(allowedOrigins.has(origin)?{'access-control-allow-origin':origin}:{}),
 'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
 'access-control-allow-methods':'POST, OPTIONS'}
});
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!allowedOrigins.has(origin))return reply({error:'Origin not allowed'},403,origin);
 if(req.method==='OPTIONS')return reply({},204,origin);
 if(req.method!=='POST')return reply({error:'Method not allowed'},405,origin);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),
 service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),resend=Deno.env.get('RESEND_API_KEY'),sender=Deno.env.get('GBB_FROM_EMAIL');
 if(!url||!anon||!service||!resend||!sender)return reply({error:'Email service is not configured'},503,origin);
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(bearer))return reply({error:'Sign-in required'},401,origin);
 let body;try{body=await req.json()}catch{return reply({error:'Invalid JSON'},400,origin)}
 const userId=String(body?.user_id||'');
 if(!uuid.test(userId))return reply({error:'Invalid user'},400,origin);
 try{
  const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,authorization:bearer}});
  if(!userResponse.ok)return reply({error:'Sign-in required'},401,origin);
  const staff=await fetch(url+'/rest/v1/rpc/is_verification_staff',{method:'POST',headers:{apikey:anon,authorization:bearer,'content-type':'application/json'},body:'{}'});
  if(!staff.ok||await staff.json()!==true)return reply({error:'Staff access required'},403,origin);
  const admin={apikey:service,authorization:'Bearer '+service};
  const requestResponse=await fetch(url+'/rest/v1/verification_requests?user_id=eq.'+userId+'&select=identity_path,licence_path',{headers:admin});
  const reviewResponse=await fetch(url+'/rest/v1/verification_reviews?user_id=eq.'+userId+'&select=status,reviewed_at,identity_path,licence_path',{headers:admin});
  if(!requestResponse.ok||!reviewResponse.ok)throw Error('Review lookup failed');
  const record=(await requestResponse.json())[0],review=(await reviewResponse.json())[0];
  if(!record||!review||review.status!=='approved'||!review.reviewed_at||
     record.identity_path!==review.identity_path||record.licence_path!==review.licence_path)
    return reply({error:'No current approved verification'},409,origin);
  const eventKey='verification_approved:'+userId+':'+review.reviewed_at;
  const sentCheck=await fetch(url+'/rest/v1/booking_email_events?event_key=eq.'+encodeURIComponent(eventKey)+'&select=event_key',{headers:admin});
  if(!sentCheck.ok)throw Error('Event lookup failed');
  if((await sentCheck.json()).length)return reply({sent:true,already_sent:true},200,origin);
  const authUser=await fetch(url+'/auth/v1/admin/users/'+userId,{headers:admin});
  if(!authUser.ok)throw Error('User lookup failed');
  const recipient=(await authUser.json())?.email;
  if(!recipient)return reply({error:'Recipient email unavailable'},409,origin);
  const email=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
   authorization:'Bearer '+resend,'content-type':'application/json','Idempotency-Key':eventKey
  },body:JSON.stringify({from:sender,to:[recipient],
   subject:'Get By Boat — your ID and boat licence are verified',
   html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:36px;color:#173e4b"><h1 style="font-size:24px;color:#008da6">Get By Boat</h1><div style="background:#edf9f5;border-radius:14px;padding:22px 24px"><p style="font-size:22px;font-weight:bold;color:#147653;margin:0 0 8px">Verification approved</p><p style="line-height:1.6;margin:0">Your identity document and boat driving licence have been verified.</p></div><p style="line-height:1.6">You can now request eligible self-drive boat rentals on Get By Boat.</p><p><a href="https://getbyboat.net/#/account?tab=verification" style="display:inline-block;background:#069cb4;color:#fff;padding:13px 20px;border-radius:9px;text-decoration:none;font-weight:bold">View verification status</a></p><p style="color:#69828c;font-size:12px">This is an automated account notification. No document images are attached.</p></div>'
  })});
  if(!email.ok){console.error('Resend verification email rejected',email.status);return reply({error:'Email service did not accept the message'},502,origin)}
  const recordEvent=await fetch(url+'/rest/v1/booking_email_events',{method:'POST',headers:{...admin,'content-type':'application/json',prefer:'resolution=ignore-duplicates'},body:JSON.stringify({event_key:eventKey,delivered_at:new Date().toISOString()})});
  if(!recordEvent.ok)console.error('Verification email sent but log failed',recordEvent.status);
  return reply({sent:true},200,origin);
 }catch(error){console.error('Verification email failed',error?.message||error);return reply({error:'Unable to send verification email'},500,origin)}
});