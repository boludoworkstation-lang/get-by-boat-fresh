// Self-service account deletion. Never accepts a user ID from the browser.
const origins = new Set(['https://getbyboat.net', 'https://www.getbyboat.net']);
function respond(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status, headers: {
      'content-type': 'application/json', vary: 'Origin',
      ...(origins.has(origin) ? {'access-control-allow-origin': origin} : {}),
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info'
    }
  });
}
Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (origin && !origins.has(origin)) return respond({error:'Origin not allowed'},403,origin);
  if (request.method === 'OPTIONS') return respond({},200,origin);
  if (request.method !== 'POST') return respond({error:'Method not allowed'},405,origin);
  const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY'),
    service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return respond({error:'Deletion service unavailable'},503,origin);
  const authorization=request.headers.get('authorization') || '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return respond({error:'Sign in required'},401,origin);
  let body;
  try { body=await request.json(); } catch { return respond({error:'Invalid request'},400,origin); }
  if (body?.confirmation !== 'DELETE') return respond({error:'Type DELETE to confirm'},400,origin);
  try {
    const current=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,authorization}});
    if (!current.ok) return respond({error:'Please sign in again'},401,origin);
    const user=await current.json();
    if (!/^[0-9a-f-]{36}$/i.test(user?.id||'')) return respond({error:'Invalid account'},401,origin);
    const adminHeaders={apikey:service,authorization:'Bearer '+service};
    // Prevent destroying another customer's booking history or an owner's active fleet.
    for (const [table,column] of [['boats','owner_id'],['bookings','customer_id'],['booking_offers','owner_id']]) {
      const query=url+'/rest/v1/'+table+'?'+column+'=eq.'+encodeURIComponent(user.id)+'&select=id&limit=1';
      const result=await fetch(query,{headers:adminHeaders});
      if (!result.ok) return respond({error:'Unable to verify linked reservations. No changes made.'},503,origin);
      if ((await result.json()).length) return respond({
        error:'This account has boat listings or reservation records. Automatic deletion is unavailable while these records are linked. Please contact support to resolve them safely.'
      },409,origin);
    }
    // Supabase Auth deletion is server-only and enforces FK/storage restrictions.
    // Do not bypass those restrictions or remove another user's booking data.
    const deleted=await fetch(url+'/auth/v1/admin/users/'+encodeURIComponent(user.id),{
      method:'DELETE',headers:adminHeaders
    });
    if (!deleted.ok) {
      console.error('Account deletion blocked by auth dependencies',deleted.status);
      return respond({error:'Account deletion is blocked by linked records or uploaded documents. No account was deleted; contact support to resolve these records.'},409,origin);
    }
    return respond({deleted:true},200,origin);
  } catch (error) {
    console.error('Account deletion failed',error);
    return respond({error:'Unable to delete account right now. Please try again later.'},500,origin);
  }
});
