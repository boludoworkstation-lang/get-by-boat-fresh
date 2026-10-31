/* Live marketplace. Authorization and prices are enforced by database policies/triggers. */
(() => {
  let client, session, profile, epoch=0, recovery=false, authStep='email', authEmail='', authBackground=null, returnRoute='#/', ownerIntent=new URLSearchParams(location.search).get('owner')==='1';
  let authNext='#/dashboard', avatarUrl='',verificationRequest=null,verificationReview=null,verificationStaff=false;
  let ownerVerificationRequest=null,ownerVerificationReview=null,ownerScrollTarget='';
  let chatChannel=null,chatBookingId='';
  let calendarSelection=null,calendarUnavailable=[],calendarContext=null,ownerPickupMap=null;
  const safeNext=value=>{const v=String(value||'');return v.length<1500 && (/^#\/(dashboard|bookings|owner|account|favourites|staff|messages)$/.test(v)||/^#\/messages\?booking=[a-fA-F0-9-]{36}$/.test(v)||/^#\/listing\/[a-zA-Z0-9-]+(?:\?[^#]*)?$/.test(v))?v:'#/dashboard'};
  const loginLink=next=>'#/login?next='+encodeURIComponent(safeNext(next));
  const setupLink=next=>'#/account?next='+encodeURIComponent(safeNext(next));
  const afterLogin=()=>authNext;
  const esc=safe;
  const money=v=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(Number(v));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const euroDate=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))?`${iso.slice(8,10)}.${iso.slice(5,7)}.${iso.slice(0,4)}.`:'';
  const euroRange=(start,end)=>{
    if(!start||!end)return '';
    if(start===end)return euroDate(start);
    return start.slice(0,4)===end.slice(0,4)?`${start.slice(8,10)}.${start.slice(5,7)}. – ${euroDate(end)}`:`${euroDate(start)} – ${euroDate(end)}`;
  };
  const parseEuroDate=value=>{
    const match=String(value||'').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
    if(!match)return '';
    const iso=`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    const parsed=new Date(iso+'T00:00:00Z');
    return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso?iso:'';
  };
  const field=(label,name,type='text',value='',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const namePart=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,100);
  function identityNames(user){
    const metadata=user?.user_metadata||{};
    let first=namePart(metadata.given_name||metadata.first_name);
    let last=namePart(metadata.family_name||metadata.last_name);
    const full=namePart(metadata.full_name||metadata.name);
    if((!first||!last)&&full&&!full.includes('@')){
      const words=full.split(' ');
      if(words.length>1){first=first||words[0];last=last||words.slice(1).join(' ')}
    }
    return {first,last,full:first&&last?`${first} ${last}`.slice(0,120):''};
  }
  const hasProfileName=p=>!!p?.display_name?.trim()&&p.display_name.trim()!=='Traveller';
  function verificationState(){
    if(!verificationRequest)return 'not_submitted';
    if(!verificationReview || verificationReview.identity_path!==verificationRequest.identity_path ||
      verificationReview.licence_path!==verificationRequest.licence_path ||
      verificationReview.reviewed_birth_date!==verificationRequest.birth_date ||
      verificationReview.reviewed_licence_type!==verificationRequest.licence_type ||
      verificationReview.reviewed_licence_expiry!==verificationRequest.licence_expiry ||
      (profile?.details?.birth_date&&profile.details.birth_date!==verificationRequest.birth_date) ||
      verificationReview.reviewed_name?.trim().toLocaleLowerCase()!==profile?.display_name?.trim().toLocaleLowerCase())return 'pending';
    if(verificationReview.status==='approved'&&verificationRequest.licence_expiry&&verificationRequest.licence_expiry<today())return 'expired';
    return verificationReview.status;
  }
  const verificationLabel=s=>({approved:'Verified',pending:'Pending staff review',rejected:'Needs correction',expired:'Licence expired',draft:'In progress',not_submitted:'Not verified'}[s]||'Not verified');
  function ownerReviewIsCurrent(request,review,ownerName){
    if(!request||!review||!review.reviewed_request)return false;
    return String(review.reviewed_name||'').trim().toLocaleLowerCase()===String(ownerName||'').trim().toLocaleLowerCase()
      && Object.keys(request).every(key=>key==='application_state'||JSON.stringify(request[key])===JSON.stringify(review.reviewed_request[key]));
  }
  function ownerVerificationState(){
    if(!ownerVerificationRequest)return 'not_submitted';
    if(ownerVerificationRequest.application_state==='draft')return 'draft';
    if(!ownerReviewIsCurrent(ownerVerificationRequest,ownerVerificationReview,profile?.display_name))return 'pending';
    return ownerVerificationReview.status;
  }
  const btn=(text,action,id='')=>`<button type="button" class="btn live-secondary" data-live="${action}" data-id="${esc(id)}">${esc(text)}</button>`;
  const ownerView=()=>parseRoute().path==='/owner'||(parseRoute().path==='/account'&&safeNext(parseRoute().params.get('next'))==='#/owner');
  const nav=()=>`<nav class="live-nav"><a href="#/boats">Explore boats</a>${profile?.account_type==='owner'?'<a href="#/owner">My boats</a>':'<a href="#/bookings">My bookings</a>'}${session?'<a href="#/account">My profile</a>'+btn('Log out','logout'):'<a href="#/login">Log in</a>'}</nav>`;
  const page=(title,body)=>{
    const {path,params}=parseRoute();
    if(session&&['/dashboard','/bookings','/owner','/account','/favourites','/staff','/messages'].includes(path)){
      const isOwner=profile?.account_type==='owner';
      const links=[['/dashboard','Overview','dashboard'],['/account','My profile','user'],...(isOwner?[['/owner','My boats','ship'],['/owner?view=requests','Booking requests','mail']]:[['/bookings','My bookings','calendar'],['/favourites','Saved boats','heart']]),['/messages','Messages','message'],...(verificationStaff?[['/staff','Staff verification','shield']]:[])];
      const memberName=esc(profile?.display_name||'Traveller');
      const initials=esc((profile?.display_name||'G').slice(0,1).toUpperCase());
      return `<header class="member-header"><a class="member-brand" href="#/">${waveLogo()}<span>Get By Boat</span></a><nav aria-label="Top navigation"><span class="member-locale">EN · EUR</span>${isOwner?`<a class="member-host-link" href="#/owner">${icon('plus')} My boats</a>`:''}<a class="member-mini-avatar" href="#/account" aria-label="My profile">${avatarUrl?`<img src="${esc(avatarUrl)}" alt="">`:initials}</a></nav></header><main class="member-shell"><aside class="member-sidebar"><div class="member-side-label">MY ACCOUNT</div><a href="#/account" class="member-identity">${avatarUrl?`<img class="member-avatar" src="${esc(avatarUrl)}" alt="Your profile photo">`:`<div class="member-avatar member-avatar-empty" aria-hidden="true">${initials}</div>`}<span><strong>${memberName}</strong><small>${isOwner?'Boat owner':'Traveller account'}</small></span>${icon('chevron')}</a><nav aria-label="Account navigation">${links.map(([href,label,symbol])=>`<a href="#${href}" ${path===href.split('?')[0]&&(href.includes('?')?params.get('view')==='requests':!params.get('view'))?'aria-current="page"':''}>${icon(symbol)}<span>${label}</span></a>`).join('')}</nav><div class="member-side-bottom"><a href="#/contact">${icon('headset')} Help & support</a><button type="button" data-live="logout">${icon('arrow')} Log out</button></div></aside><section class="member-main">${path==='/dashboard'||(path==='/owner'&&params.has('edit'))?'':`<div class="member-page-kicker">YOUR GET BY BOAT ACCOUNT</div><h1>${title}</h1>`}${body}</section></main>`;
    }
    return `${header()}<main class="shell live-page">${nav()}<h1>${title}</h1>${body}</main>${footer()}`;
  };
  const errorText=e=>esc(e?.message||'Something went wrong. Please try again.');
  const status=s=>({pending_owner:'Waiting for owner',awaiting_payment:'Accepted · payment not connected',confirmed:'Confirmed',cancelled:'Cancelled',declined:'Declined'}[s]||s);
  const check=({data,error})=>{if(error)throw error;return data};
  const dateFields=()=>field('First day','start_date','date',state.start||today(),`required min="${today()}"`)+field('Last day','end_date','date',state.end||state.start||today(),`required min="${today()}"`);
  const calendarDateFields=()=>{
    const first=state.start||today(),last=state.end||first;
    return `<div class="fleet-euro-dates"><label>First day (DD.MM.YYYY)<input type="text" inputmode="numeric" data-euro-date="start_date" value="${euroDate(first)}" placeholder="DD.MM.YYYY" autocomplete="off"><input type="hidden" name="start_date" value="${first}"></label><label>Last day (DD.MM.YYYY)<input type="text" inputmode="numeric" data-euro-date="end_date" value="${euroDate(last)}" placeholder="DD.MM.YYYY" autocomplete="off"><input type="hidden" name="end_date" value="${last}"></label></div>`;
  };
  const photo=url=>{try{const u=new URL(url);return u.origin===AUTH_CONFIG.supabaseUrl&&u.pathname.startsWith('/storage/v1/object/public/boat-photos/')?u.href:''}catch{return ''}};
  const picture=b=>photo(b.photo_url)?`<img class="live-photo" src="${esc(photo(b.photo_url))}" alt="${esc(b.name)}" loading="lazy">`:'<div class="live-placeholder">A day at sea awaits</div>';
  const socialButton=(provider,label)=>`<button type="button" class="auth-provider" data-live="social-${provider}"><span aria-hidden="true" class="auth-provider-icon">${provider==='google'?'<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3-4.5 3-7.7z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.8-2.5l-3.4-2.6c-.9.6-2 .9-3.4.9-2.7 0-5-1.8-5.8-4.2H2.7v2.7A10.3 10.3 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.2V7.7H2.7a10 10 0 0 0 0 8.6z"/><path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.8 1.5L18.7 5A9.6 9.6 0 0 0 12 2a10.3 10.3 0 0 0-9.3 5.7l3.5 2.7C7 8 9.3 6.2 12 6.2z"/></svg>':'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.1 12.7c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.7 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .6 1 1.4 2 2.4 1.9 1-.1 1.3-.7 2.6-.7s1.6.7 2.7.7 1.7-1 2.4-1.9c.7-1.1 1-2.1 1-2.2-.1 0-1.9-.7-1.9-3.1zM15.1 6.7c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.8-1 2.8 1 .1 2-.5 2.7-1.2z"/></svg>'}</span>${label}</button>`;
  const loginPage=()=>`<div class="auth-background" inert aria-hidden="true">${authBackground||home()}</div><div class="auth-scrim" data-auth-backdrop><section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" tabindex="-1"><div class="auth-dialog-head"><button type="button" class="auth-close" data-live="auth-close" aria-label="Close login">×</button><span>${recovery?'Reset password':ownerIntent?'Boat owner · Log in or sign up':'Customer · Log in or sign up'}</span></div><div class="auth-dialog-body"><h2 id="auth-dialog-title">${recovery?'Set a new password':ownerIntent?'Welcome aboard, captain':'Welcome to Get By Boat'}</h2>${!recovery?`<p class="auth-owner-copy">${ownerIntent?'List your boat, manage your calendar and respond to booking requests.':authNext.startsWith('#/listing/')?'Log in to continue your booking request. Your boat and dates are saved.':'Find your next day at sea and manage your booking requests.'}</p>`:''}<form data-live-form="auth" class="live-form auth-form">${!recovery?field('Email','email','email',authEmail,'required autocomplete="email" placeholder="Email"'):''}${recovery||authStep==='password'?field('Password','password','password','','required minlength="'+(recovery||authMode==='signup'?'10':'1')+'" autocomplete="'+(recovery||authMode==='signup'?'new-password':'current-password')+'"'):''}<button class="btn auth-primary" type="submit">${recovery?'Save password':authStep==='email'?'Continue':authMode==='signup'?'Create account':'Log in'}</button><p role="status" data-feedback></p>${!recovery?`<div class="live-auth-divider">OR</div><div class="live-social">${socialButton('google','Continue with Google')}${socialButton('apple','Continue with Apple')}</div><div class="auth-switch"><button type="button" data-live="auth-mode">${authMode==='signup'?'Already registered? Log in':'New here? Create account'}</button>${authStep==='password'?'<button type="button" data-live="reset">Forgot password?</button>':''}</div>`:''}</form></div></section></div>`;
  const authRedirect=()=>location.origin+location.pathname+'?auth_callback=1'+loginLink(authNext);
  function closeAuth(){authStep='email';authEmail='';authBackground=null;ownerIntent=false;location.hash=/^#\/(owner|account|bookings|login)(?:\?|$)/.test(returnRoute)?'#/':returnRoute;render();setTimeout(()=>document.querySelector('a[href="#/login"]')?.focus(),0)}
  function focusAuth(){const dialog=document.querySelector('.auth-dialog');document.body?.classList.toggle('auth-open',!!dialog);if(dialog)(dialog.querySelector('input[name="display_name"]')||dialog.querySelector(authStep==='password'?'input[name="password"]':'input'))?.focus();}
  document.addEventListener('keydown',event=>{const dialog=document.querySelector('.auth-dialog');if(!dialog)return;if(event.key==='Escape'){event.preventDefault();closeAuth();return}if(event.key==='Tab'){const items=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],select,textarea')];const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}});
  document.addEventListener('click',event=>{if(event.target.matches?.('[data-auth-backdrop]'))closeAuth()});
  const profileForm=(next='#/bookings')=>{
    const destination=safeNext(next),owner=profile?.account_type==='owner';
    const names=identityNames(session?.user),d=profile?.details||{};
    return `<form data-live-form="profile" data-next="${esc(destination)}" class="live-card live-form"><h2>${owner?'Complete your owner profile':'Complete your customer profile'}</h2><p>Confirm your name to finish setting up your ${owner?'owner':'customer'} account.</p><div class="live-columns">${field('First name','first_name','text',d.first_name||names.first,'required maxlength="100" autocomplete="given-name"')}${field('Surname','last_name','text',d.last_name||names.last,'required maxlength="100" autocomplete="family-name"')}</div><button class="btn">Continue to my account</button><p role="status" data-feedback></p></form>`;
  };
  const profileDialog=(next=authNext)=>{
    const destination=safeNext(next),owner=profile?.account_type==='owner';
    // Provider metadata is only a name suggestion, never an authorization claim.
    const names=identityNames(session?.user),d=profile?.details||{};
    const first=d.first_name||names.first,last=d.last_name||names.last;
    return `<div class="auth-background" inert aria-hidden="true">${authBackground||home()}</div><div class="auth-scrim" data-auth-backdrop><section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" tabindex="-1"><div class="auth-dialog-head"><button type="button" class="auth-close" data-live="auth-close" aria-label="Close account setup">×</button><span>${owner?'Your owner account':'Finish signing up'}</span></div><div class="auth-dialog-body"><div class="auth-step-label">ONE LAST THING</div><h2 id="auth-dialog-title">${owner?'Welcome aboard, captain':'Welcome aboard!'}</h2><p class="auth-owner-copy">${owner?'Confirm your details to start listing your boat.':'We couldn’t retrieve your full name from your sign-in provider. Enter it once to finish your customer account.'}</p><form data-live-form="profile" data-next="${esc(destination)}" class="live-form auth-form"><div class="auth-name-fields">${field('First name','first_name','text',first,'required maxlength="100" autocomplete="given-name" placeholder="First name"')}${field('Surname','last_name','text',last,'required maxlength="100" autocomplete="family-name" placeholder="Surname"')}</div><button class="btn auth-primary" type="submit">${owner?'Continue to my boats':destination.startsWith('#/listing/')?'Continue to my boat':'Go to my dashboard'}</button><p role="status" data-feedback></p><p class="auth-profile-note">Your ${owner?'owner':'customer'} account is already created. You can change your details later in My profile.</p></form></div></section></div>`;
  };
  async function current(){const {data,error}=await client.auth.getUser();if(error&&!error.message?.includes('Auth session missing'))throw error;session=data.user?{user:data.user}:null;profile=session?check(await client.from('profiles').select('*').eq('id',session.user.id).maybeSingle()):null;
    if(session){
      const names=identityNames(session.user);
      if(!profile){
        // Choose a role on first signup only. An existing profile can never switch roles.
        const details=names.full?{first_name:names.first,last_name:names.last}:{};
        const path=parseRoute().path,params=parseRoute().params;
        const initialRole=ownerIntent||path==='/owner'||(path==='/login'&&safeNext(params.get('next'))==='#/owner')?'owner':'customer';
        check(await client.from('profiles').upsert({id:session.user.id,display_name:names.full,details,account_type:initialRole},{onConflict:'id',ignoreDuplicates:true}));
        profile=check(await client.from('profiles').select('*').eq('id',session.user.id).maybeSingle());
      }
      if(profile&&names.full){
        // Backfill incomplete records without overwriting names edited by the customer.
        const details=profile.details||{},changes={...details},blank=!hasProfileName(profile);
        if(!details.first_name)changes.first_name=names.first;
        if(!details.last_name)changes.last_name=names.last;
        if(blank||!details.first_name||!details.last_name){
          const value={details:changes};if(blank)value.display_name=names.full;
          profile=check(await client.from('profiles').update(value).eq('id',session.user.id).select().single());
        }
      }
    }
    verificationRequest=null;verificationReview=null;ownerVerificationRequest=null;ownerVerificationReview=null;verificationStaff=false;
    if(session){
      verificationStaff=!!check(await client.rpc('is_verification_staff'));
      verificationRequest=check(await client.from('verification_requests').select('*').eq('user_id',session.user.id).maybeSingle());
      verificationReview=check(await client.from('verification_reviews').select('*').eq('user_id',session.user.id).maybeSingle());
      if(profile?.account_type==='owner'){
        ownerVerificationRequest=check(await client.from('owner_verification_requests').select('*').eq('user_id',session.user.id).maybeSingle());
        ownerVerificationReview=check(await client.from('owner_verification_reviews').select('*').eq('user_id',session.user.id).maybeSingle());
      }
    }
    avatarUrl='';if(profile?.avatar_path){const result=await client.storage.from('profile-photos').createSignedUrl(profile.avatar_path,3600);if(!result.error)avatarUrl=result.data.signedUrl;}
  }
  const requireAccount=()=>!session?loginPage():!hasProfileName(profile)?profileDialog(authNext):null;
  function verificationForm(){
    const v=verificationRequest||{},s=verificationState();
    return `<div class="profile-panel verification-intro"><div class="verification-heading"><div><span class="member-page-kicker">IDENTITY & BOATING SAFETY</span><h2>Verify your identity and boat licence</h2><p>Verification is optional for your account and for rentals with a skipper. To rent without a skipper, upload both your ID/passport and boating licence and wait for staff approval.</p></div><span class="verification-badge ${esc(s)}">${esc(verificationLabel(s))}</span></div><div class="verification-steps"><span>${icon('user')} Your legal name</span><span>${icon('shield')} ID / passport</span><span>${icon('ship')} Boat licence</span><span>${icon('check')} Staff review</span></div>${s==='rejected'&&verificationReview?.note?`<p class="verification-warning">Reviewer note: ${esc(verificationReview.note)}</p>`:''}${s==='approved'?'<p class="verification-good">Your identity and boating licence have been approved. You can request a rental without a skipper while your licence remains valid. Uploading replacement documents starts a new review.</p>':''}${s==='pending'?'<p class="member-note">Your documents have been submitted. A Get By Boat staff member will review the information. Until approved, you can still rent a boat with a skipper.</p>':''}</div>
    <form class="profile-panel live-form verification-upload" data-live-form="verification" enctype="multipart/form-data"><h2>${v.user_id?'Update verification documents':'Submit documents for verification'}</h2><p class="member-note">The name on your ID/passport and boat licence must match your customer profile: <strong>${esc(profile.display_name)}</strong>. If it does not, correct your profile before uploading.</p><div class="live-columns"><label>Identity document type<select name="identity_type" required><option value="id_card" ${v.identity_type==='id_card'?'selected':''}>National ID card</option><option value="passport" ${v.identity_type==='passport'?'selected':''}>Passport</option></select></label>${field('Date of birth (as shown on ID)','birth_date','date',v.birth_date||profile.details?.birth_date||'',`required max="${today()}"`)}</div><div class="live-columns"><label>ID card / passport image or PDF<input type="file" name="identity_file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><label>Boat driving licence image or PDF<input type="file" name="licence_file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label></div><div class="live-columns"><label>Boat licence category<select name="licence_type" required>${[['coastal','Coastal'],['offshore','Offshore'],['inland','Inland'],['professional','Professional skipper'],['other','Other recognised licence']].map(([value,label])=>`<option value="${value}" ${v.licence_type===value?'selected':''}>${label}</option>`).join('')}</select></label>${field('Licence expiration (leave blank if permanent)','licence_expiry','date',v.licence_expiry||'')}</div><label class="live-check"><input type="checkbox" name="documents_own" required> I confirm both documents are mine, accurate and provided for Get By Boat staff to verify my identity and qualification.</label><p class="member-note">Accepted: JPEG, PNG, WebP or PDF, up to 5 MB each. Private documents are not shared with boat owners. Reviewers should delete copies after review. <a href="#/privacy">Privacy information</a> · <a href="#/contact">Request document deletion</a></p><button class="btn" type="submit">${s==='approved'?'Submit replacement documents':'Submit for manual review'}</button><p role="status" data-feedback></p></form>`;
  }
  const ownerCountryOptions=[['HR','Croatia · OIB'],['FR','France · SIRET'],['IT','Italy · VAT'],['ES','Spain · NIF/CIF'],['DE','Germany · Tax ID'],['GB','United Kingdom · Company number'],['US','United States · Business tax ID']];
  const ownerComplete=v=>!!(v?.business_country&&v.legal_business_name&&v.tax_identifier&&v.registered_address&&v.business_website&&v.iban&&v.iban_holder&&v.identity_type&&v.registration_path&&v.identity_path&&v.iban_proof_path);
  function ownerProgress(){
    const v=ownerVerificationRequest||{},s=ownerVerificationState();
    const steps=[['Business information',!!(v.business_country&&v.legal_business_name&&v.tax_identifier&&v.registered_address&&v.business_website),'business'],['Payout details',!!(v.iban&&v.iban_holder),'payouts'],['Three verification documents',!!(v.registration_path&&v.identity_path&&v.iban_proof_path),'verification']];
    return `<div class="profile-panel verification-intro owner-verification-overview"><div class="verification-heading"><div><span class="member-page-kicker">PUBLISHING REQUIREMENTS</span><h2>${s==='approved'?'Your business is verified':'Get your business ready to publish'}</h2><p>Complete these steps at your own pace. Save each step separately, then send everything for one staff review. You can create draft listings meanwhile.</p></div><span class="verification-badge ${esc(s)}">${esc(verificationLabel(s))}</span></div><div class="owner-progress" aria-label="Verification progress">${steps.map(([title,ready],i)=>`<button type="button" data-live="owner-jump" data-id="${['owner-business-details','owner-payout-details','owner-documents'][i]}" class="owner-progress-step ${ready?'complete':''}"><span aria-hidden="true">${ready?'✓':i+1}</span><span>${title}<small>${ready?'Saved':'To complete'}</small></span></button>`).join('')}</div>${s==='approved'?'<p class="verification-good">Your business is approved. You can publish listings. Changes to approved details or documents require another review.</p>':''}${s==='pending'?'<p class="member-note">Your application is awaiting staff review. If you make changes, remember to resubmit.</p>':''}${s==='rejected'&&ownerVerificationReview?.note?`<p class="verification-warning">Reviewer note: ${esc(ownerVerificationReview.note)}</p>`:''}</div>`;
  }
  function ownerBusinessForm(){
    const v=ownerVerificationRequest||{},code=v.business_country||'HR';
    return ownerProgress()+`<form class="profile-panel live-form" data-live-form="owner-business"><h2>Business information</h2><p class="member-note">Enter the legal details of your registered company or trade. Use the country where the business is registered, even if your boats operate elsewhere. The business website is required.</p><div class="live-columns"><label>Business registration country<select name="business_country" required>${ownerCountryOptions.map(([value,label])=>`<option value="${value}" ${code===value?'selected':''}>${esc(label)}</option>`).join('')}<option value="OTHER" ${!ownerCountryOptions.some(([value])=>value===code)?'selected':''}>Another country</option></select></label>${field('Legal business / trade name','legal_business_name','text',v.legal_business_name||'','required minlength="2" maxlength="180"')}</div>${field('If another country, enter 2-letter code','other_business_country','text',ownerCountryOptions.some(([value])=>value===code)?'':code,'maxlength="2" pattern="[A-Za-z]{2}"')}<div class="live-columns">${field('Registration / tax number (OIB, SIRET, VAT…)','tax_identifier','text',v.tax_identifier||'','required maxlength="80"')}${field('Business website (required)','business_website','url',v.business_website||'','required maxlength="300" placeholder="https://yourcompany.com"')}</div><label>Registered business address<textarea name="registered_address" rows="2" required minlength="6" maxlength="350" placeholder="Street, postal code, city and country">${esc(v.registered_address||'')}</textarea></label><button class="btn" type="submit">Save business information</button><p data-feedback role="status"></p></form>`;
  }
  function ownerPayoutForm(){
    const v=ownerVerificationRequest||{};
    return ownerProgress()+`<form class="profile-panel live-form" data-live-form="owner-payouts"><h2>Payout details</h2><p class="member-note">The bank account must belong to your registered business. These details will be reviewed before publication. Automated payouts are not yet active.</p><div class="live-columns">${field('Business IBAN','iban','text',v.iban||'','required minlength="15" maxlength="42" autocomplete="off" placeholder="HR…"')}${field('Account holder (legal business name)','iban_holder','text',v.iban_holder||'','required minlength="2" maxlength="180"')}</div><button class="btn" type="submit">Save payout details</button><p data-feedback role="status"></p></form>`;
  }
  function ownerVerificationForm(){
    const v=ownerVerificationRequest||{},s=ownerVerificationState();
    const docs=[['registration','registration_path','Company / trade registration certificate'],['identity','identity_path','Owner / manager ID or passport'],['iban','iban_proof_path','Proof of business IBAN ownership']];
    const pieces=docs.map(([key,path,label])=>`<form class="owner-document-card live-form" data-live-form="owner-document" data-document="${key}" enctype="multipart/form-data"><div class="owner-document-head"><strong>${esc(label)}</strong><span class="verification-badge ${!v[path]?'missing':s==='approved'?'approved':'uploaded'}">${!v[path]?'Missing':s==='approved'?'Verified':'Uploaded'}</span></div>${key==='identity'?`<label>Document type<select name="identity_type"><option value="id_card" ${v.identity_type!=='passport'?'selected':''}>National ID card</option><option value="passport" ${v.identity_type==='passport'?'selected':''}>Passport</option></select></label>`:''}<label>${v[path]?'Replace document':'Select document'}<input type="file" name="document_file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><button class="btn live-secondary" type="submit">${v[path]?'Replace file':'Upload file'}</button><p data-feedback role="status"></p></form>`).join('');
    return ownerProgress()+`<section class="profile-panel"><h2>Verification & documents</h2><p class="member-note">Upload each document separately. You can replace one file without uploading the others again. Only authorised Get By Boat staff can review these private files. JPEG, PNG, WebP or PDF, up to 5 MB each.</p><div class="owner-documents-grid">${pieces}</div></section><form class="profile-panel live-form owner-submit-form" data-live-form="owner-submit"><h2>Send for staff review</h2><p class="member-note">You need complete business information, a business IBAN, all three documents and your legal profile name before submitting.</p><label class="live-check"><input type="checkbox" name="documents_own" required> I am authorised to represent the business and confirm all submitted information is accurate.</label><button class="btn" type="submit" ${!ownerComplete(v)||s==='approved'||s==='pending'?'disabled':''}>${s==='rejected'?'Resubmit for review':'Submit for review'}</button>${!ownerComplete(v)?'<p class="member-note">Complete the items above to enable submission.</p>':''}${s==='pending'?'<p class="member-note">Already submitted. You will be notified after review.</p>':''}<p data-feedback role="status"></p></form>`;
  }
  function ownerBusinessWorkspace(){
    const overview=ownerProgress();
    const stages=[
      ['01','Business information','Add the legal company or trade details, including the mandatory website.','owner-business-details',ownerBusinessForm()],
      ['02','Payout details','Add the business bank account so the team can verify ownership.','owner-payout-details',ownerPayoutForm()],
      ['03','Documents & review','Upload three private files separately, then submit one application.','owner-documents',ownerVerificationForm()]
    ];
    return `<div class="owner-workspace">${overview}<div class="owner-workspace-heading"><h2>Complete your business profile</h2><p>You do not need to finish everything today. Your saved information stays here until you're ready to submit.</p></div>${stages.map(([number,title,description,id,html])=>`<section id="${id}" class="owner-workflow-section"><div class="owner-workflow-heading"><span class="owner-step-number">${number}</span><div><h2>${title}</h2><p>${description}</p></div></div>${html.startsWith(overview)?html.slice(overview.length):html}</section>`).join('')}</div>`;
  }
  function accountProfile(tab){
    const d=profile.details||{};
    const isOwner=profile.account_type==='owner';
    if(tab==='experience')tab='information';
    if(isOwner&&['payouts','verification'].includes(tab))tab='business';
    let tabs=`<nav class="member-tabs ${isOwner?'owner-account-tabs':''}" aria-label="Profile sections">${(isOwner?[['information','Personal profile'],['business','Business & verification'],['password','Security']]:[['verification','Verifications'],['information','Information'],['password','Password']]).map(([id,label])=>`<a href="#/account?tab=${id}" ${tab===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
    if(isOwner&&tab==='business')return tabs+ownerBusinessWorkspace();
    if(tab==='verification')return tabs+verificationForm();
    if(tab==='password')return tabs+`<form class="profile-panel live-form" data-live-form="password"><h2>Change your password</h2>${field('New password','password','password','','required minlength="10" autocomplete="new-password"')}${field('Re-enter new password','confirm','password','','required minlength="10" autocomplete="new-password"')}<button class="btn">Save password</button><p data-feedback role="status"></p></form><section class="profile-panel"><h2>Email notifications · Test</h2><p class="member-note">Send one test email to your confirmed sign-in address <strong>${esc(session.user.email||'')}</strong>. This does not create a booking or access documents. Limited to one email per day.</p>${btn('Send me a test email','test-email')}<p data-email-test-feedback role="status"></p></section><div class="profile-panel"><h2>Account support</h2><p>To request deletion of your account and personal data, contact our team from your registered email address.</p><a href="#/contact">Request account deletion</a></div>`;
    return tabs+`<form class="profile-panel live-form" data-live-form="avatar"><h2>Your profile photo</h2><div class="profile-photo-preview">${avatarUrl?`<img src="${esc(avatarUrl)}" alt="Your profile photo">`:'<span aria-hidden="true">◎</span>'}</div><label>Select an image<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><small>JPEG, PNG or WebP. Maximum 5 MB. Your photo is stored privately.</small><button class="btn">Save photo</button><p data-feedback role="status"></p></form><form class="profile-panel live-form" data-live-form="details" data-section="information"><h2>Personal information</h2><p class="member-note">Your name is filled from Google when available, or from the details you supplied during sign-up. You can edit it here.</p><div class="live-columns">${field('First name','first_name','text',d.first_name||'','required maxlength="100" autocomplete="given-name"')}${field('Surname','last_name','text',d.last_name||'','required maxlength="100" autocomplete="family-name"')}${field('Email','email','email',session.user.email||'','readonly')}${field('Date of birth (optional)','birth_date','date',d.birth_date||'',`max="${today()}"`)}${field('Languages spoken','languages','text',d.languages||'','maxlength="150"')}${field('Telephone','phone','tel',d.phone||'','maxlength="40" autocomplete="tel"')}${field('Address','address','text',d.address||'','maxlength="200" autocomplete="street-address"')}${field('Postal code','postal_code','text',d.postal_code||'','maxlength="30" autocomplete="postal-code"')}${field('City','city','text',d.city||'','maxlength="100" autocomplete="address-level2"')}</div><p class="member-note">Your personal details are private to your account. Contact details are optional.</p><button class="btn">Save details</button><p data-feedback role="status"></p></form>`;
  }
  const rentalOptions=b=>[b.with_skipper?'Rent with skipper':null,b.without_skipper!==false?'Rent without skipper':null].filter(Boolean).join(' · ');
  const guestDailyRate=amount=>Math.round(Number(amount)*1.07*100)/100;
  const countryLabels=['Croatia','Greece','Spain','France','Italy','Portugal','Cyprus','Turkey','Malta','Australia','Montenegro','Albania','USA','Bahamas'];
  const countryMapCenters={Croatia:[43.8,15.9,8],Greece:[37.9,23.7,7],Spain:[39.4,-4,6],France:[43.3,5.1,7],Italy:[41.9,12.5,6],Portugal:[38.7,-9.2,7],Cyprus:[34.9,33.25,9],Turkey:[37,29,6],Malta:[35.9,14.5,11],Australia:[-25.27,133.77,4],Montenegro:[42.4,18.7,9],Albania:[40.8,19.5,9],USA:[37.1,-95.7,4],Bahamas:[24.25,-76.1,7]};
  const validPickupCoordinates=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  const boatPickupCoordinates=boat=>{
    if(boat.pickup_latitude===null||boat.pickup_latitude===undefined||boat.pickup_longitude===null||boat.pickup_longitude===undefined)return null;
    const lat=Number(boat.pickup_latitude),lng=Number(boat.pickup_longitude);
    return validPickupCoordinates(lat,lng)?[lat,lng]:null;
  };
  const pickupMapUrl=query=>`https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  const pickupDetails=boat=>{
    const pickup=String(boat.pickup_location||boat.location||'').trim();
    const coordinates=boatPickupCoordinates(boat);
    const query=coordinates?coordinates.join(','):[pickup,boat.location,boat.country].filter(Boolean).join(', ');
    return `<div class="fleet-public-pickup"><h3>Boat pickup location</h3><p>${icon('pin')} ${esc(pickup)}, ${esc(boat.country)}</p><iframe title="Pickup location on the map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(pickupMapUrl(query))}"></iframe></div>`;
  };
  function initOwnerPickupMap(){
    const form=document.querySelector('[data-live-form="boat"]');
    const container=form?.querySelector('[data-pickup-map]');
    if(!container)return;
    if(!window.L){container.textContent='Map could not load. You can enter coordinates manually below.';return;}
    const latitude=form.querySelector('[name="pickup_latitude"]'),longitude=form.querySelector('[name="pickup_longitude"]');
    const status=form.querySelector('[data-pickup-status]');
    const country=String(form.querySelector('[name="country"]')?.value||'');
    const countryCenter=countryMapCenters[country]||countryMapCenters.Croatia;
    const saved=latitude.value!==''&&longitude.value!==''&&validPickupCoordinates(Number(latitude.value),Number(longitude.value));
    const center=saved?[Number(latitude.value),Number(longitude.value)]:countryCenter.slice(0,2);
    const map=window.L.map(container,{scrollWheelZoom:false}).setView(center,saved?15:countryCenter[2]);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    const marker=window.L.marker(center,{draggable:true,autoPan:true}).addTo(map);
    const setCoordinates=position=>{
      latitude.value=position.lat.toFixed(6);
      longitude.value=position.lng.toFixed(6);
      if(status)status.textContent=`Exact pickup pin: ${latitude.value}, ${longitude.value}. Save the listing to keep this location.`;
    };
    marker.on('dragend',()=>setCoordinates(marker.getLatLng()));
    map.on('click',event=>{marker.setLatLng(event.latlng);setCoordinates(event.latlng);});
    if(status)status.textContent=saved?`Saved pickup pin: ${latitude.value}, ${longitude.value}. Drag it to adjust.`:'Drag the pin or click the map to mark the exact marina. The approximate country centre will not be saved until you choose a location.';
    ownerPickupMap={map,marker,form};
    setTimeout(()=>map.invalidateSize(),0);
  }
  function updateOwnerSkipperFee(form){
    if(!form)return;
    const withSkipper=!!form.querySelector('[name="with_skipper"]')?.checked;
    const withoutSkipper=!!form.querySelector('[name="without_skipper"]')?.checked;
    const separate=withSkipper&&withoutSkipper;
    const fee=form.querySelector('[name="skipper_fee_per_day"]');
    if(fee){fee.disabled=!withSkipper;fee.required=withSkipper;fee.min=withSkipper?'0.01':'0';}
    const wrapper=form.querySelector('[data-skipper-fee-wrapper]');
    if(wrapper)wrapper.hidden=!withSkipper;
    const note=form.querySelector('[data-skipper-fee-note]');
    if(note)note.textContent=separate?'This is an extra skipper fee, paid directly at check-in in cash or by card. Get By Boat takes no commission.':withSkipper?'The skipper price is already included in your boat price above. Guests will not pay it again at check-in.':'Select Rent with skipper to enter the skipper price.';
    const summary=form.querySelector('[data-rental-mode-summary]');
    if(summary)summary.textContent=separate?'Both options selected — guests choose with or without skipper.':withSkipper?'With skipper only.':withoutSkipper?'Without skipper only.':'Choose at least one rental option.';
  }
  const ownerStepNames=['Boat & location','Price & skipper','Photos & details'];
  function showOwnerBoatStep(form,next){
    if(!form?.querySelectorAll)return;
    const step=Math.min(3,Math.max(1,Number(next)||1));
    form.dataset.editorStep=String(step);
    for(const section of form.querySelectorAll('[data-editor-step]'))section.hidden=Number(section.dataset.editorStep)!==step;
    for(const button of form.querySelectorAll('[data-live="boat-step"]')){
      if(Number(button.dataset.step)===step)button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
    const prev=form.querySelector('[data-live="boat-prev"]'),nextButton=form.querySelector('[data-live="boat-next"]'),progress=form.querySelector('[data-editor-progress]');
    if(prev)prev.hidden=step===1;
    if(nextButton)nextButton.hidden=step===3;
    if(progress)progress.textContent=`Step ${step} of 3 · ${ownerStepNames[step-1]}`;
    if(step===1&&ownerPickupMap)setTimeout(()=>ownerPickupMap?.map.invalidateSize(),0);
  }
  function validateOwnerBoatStep(form,step){
    if(!form?.querySelectorAll)return true;
    const section=form.querySelector(`[data-editor-step="${step}"]`);
    if(!section)return true;
    const invalid=[...section.querySelectorAll('input,select,textarea')].find(input=>!input.disabled&&typeof input.checkValidity==='function'&&!input.checkValidity());
    if(invalid){
      showOwnerBoatStep(form,step);
      invalid.focus?.();
      invalid.reportValidity?.();
      return false;
    }
    if(step===2&&!form.querySelector('[name="with_skipper"]')?.checked&&!form.querySelector('[name="without_skipper"]')?.checked){
      showOwnerBoatStep(form,2);
      toast('Select at least one rental option.');
      return false;
    }
    return true;
  }
  function ownerFleet(boats,bookings,filter='all'){
    const live=boats.filter(b=>b.published).length,drafts=boats.length-live,pending=bookings.filter(r=>r.status==='pending_owner').length;
    const visible=boats.filter(b=>filter==='published'?b.published:filter==='drafts'?!b.published:true);
    const filters=[['all','All boats',boats.length],['published','Published',live],['drafts','Drafts',drafts]];
    return `<div class="fleet-home"><div class="fleet-hero"><div><span class="member-eyebrow">YOUR FLEET · GET BY BOAT</span><h2>My Boats</h2><p>Manage listings, pricing and availability in one place.</p></div><a class="btn fleet-primary" href="#/owner?edit=new">${icon('plus')} Add a boat</a></div><div class="fleet-stat-grid"><div><span>Total listings</span><strong>${boats.length}</strong><small>Boats in your account</small></div><div><span>Published</span><strong>${live}</strong><small>Visible to customers</small></div><div><span>Drafts</span><strong>${drafts}</strong><small>Not yet public</small></div><a href="#/owner?view=requests"><span>Requests to answer</span><strong>${pending}</strong><small>${pending?'Review booking requests':'All caught up'} ${icon('arrow')}</small></a></div><div class="fleet-list-head"><div><h2>Your listings</h2><p>${visible.length} ${visible.length===1?'boat':'boats'} shown</p></div><div class="fleet-filters" aria-label="Filter listings">${filters.map(([key,label,count])=>`<a href="#/owner${key==='all'?'':'?filter='+key}" ${filter===key?'aria-current="true"':''}>${label} <span>${count}</span></a>`).join('')}</div></div>${visible.length?`<div class="fleet-card-grid">${visible.map(b=>{const relevant=bookings.filter(r=>r.boat_id===b.id&&r.status==='pending_owner').length;return `<article class="fleet-card"><div class="fleet-card-photo">${picture(b)}<span class="fleet-status ${b.published?'is-live':'is-draft'}">${b.published?'● Published':'○ Draft'}</span></div><div class="fleet-card-body"><div class="fleet-card-head"><h3>${esc(b.name)}</h3><span class="fleet-daily">${money(b.price)} <small>/ day</small></span></div><p class="fleet-location">${icon('pin')} ${esc(b.location)}, ${esc(b.country)}</p><div class="fleet-specs"><span>${icon('ship')} ${esc(b.type)}</span><span>${icon('user')} ${b.guests} guests</span></div><p class="fleet-modes">${esc(rentalOptions(b))}</p>${relevant?`<p class="fleet-attention">${relevant} ${relevant===1?'booking request':'booking requests'} awaiting a reply</p>`:''}<div class="fleet-card-actions"><a class="btn" href="#/owner?edit=${esc(b.id)}">Edit listing</a><a class="fleet-link" href="#/owner?view=calendar&boat=${esc(b.id)}">${icon('calendar')} Calendar</a><a class="fleet-link" href="#/listing/${esc(b.id)}">${icon('arrow')} Preview</a></div></div></article>`}).join('')}</div>`:`<div class="fleet-empty"><span>${icon('ship')}</span><h3>${boats.length?'No boats match this filter':'Your first listing starts here'}</h3><p>${boats.length?'Choose another filter to see your boats.':'Add your boat, set your price and rental options, then prepare it for publication.'}</p><a class="btn" href="${boats.length?'#/owner':'#/owner?edit=new'}">${boats.length?'Show all boats':'Add your first boat'}</a></div>`}</div>`;
  }
  function calendarMonthContent(boat,bookings,blocks,selectedMonth){
    const safeMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth||'')?selectedMonth:today().slice(0,7);
    const [year,month]=safeMonth.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const before=(first.getUTCDay()+6)%7,back=new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7),ahead=new Date(Date.UTC(year,month,1)).toISOString().slice(0,7);
    const monthTitle=first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
    const statusDay=iso=>bookings.some(r=>['awaiting_payment','confirmed'].includes(r.status)&&r.start_date<=iso&&iso<=r.end_date)?'booked':blocks.some(b=>b.start_date<=iso&&iso<=b.end_date)?'blocked':bookings.some(r=>r.status==='pending_owner'&&r.start_date<=iso&&iso<=r.end_date)?'requested':'available';
    const dates=Array.from({length:before},()=>'<span class="fleet-calendar-empty" aria-hidden="true"></span>').concat(Array.from({length:days},(_,i)=>{
      const day=i+1,iso=`${safeMonth}-${String(day).padStart(2,'0')}`,s=statusDay(iso);
      const content=`<b>${day}</b><small>${s==='available'?'':s==='booked'?'Booked':s==='blocked'?'Blocked':'Request'}</small>`;
      if(s==='available'&&iso>=today())return `<button type="button" class="fleet-calendar-day available" data-calendar-date="${iso}" aria-pressed="false" aria-label="Select ${iso}">${content}</button>`;
      return `<span class="fleet-calendar-day ${s} ${iso<today()?'past':''}" aria-label="${iso}: ${s}; not selectable">${content}</span>`;
    }));
    return `<div class="fleet-calendar-toolbar"><h3>${esc(monthTitle)}</h3><div><button type="button" data-calendar-month="${back}" aria-label="Previous month">‹</button><button type="button" data-calendar-month="${ahead}" aria-label="Next month">›</button></div></div><div class="fleet-calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<span>${d}</span>`).join('')}</div><div class="fleet-calendar-grid">${dates.join('')}</div><div class="fleet-calendar-legend"><span><i class="available"></i> Available</span><span><i class="requested"></i> Request</span><span><i class="booked"></i> Reserved</span><span><i class="blocked"></i> Blocked</span></div>`;
  }
  function ownerCalendarBase(boat,bookings,blocks,selectedMonth){
    if(!boat)return `<div class="member-empty"><h2>Boat not found</h2><a href="#/owner">Back to My Boats</a></div>`;
    const boatBlocks=blocks.filter(b=>b.boat_id===boat.id),upcoming=bookings.filter(r=>['pending_owner','awaiting_payment','confirmed'].includes(r.status));
    return `<div class="fleet-calendar-page"><a class="fleet-back" href="#/owner">${icon('arrow')} Back to My Boats</a><div class="fleet-calendar-title"><div><span class="member-eyebrow">AVAILABILITY MANAGER</span><h2>${esc(boat.name)}</h2><p>Block dates you cannot rent. Confirmed bookings are automatically unavailable.</p></div><a class="btn live-secondary" href="#/owner?edit=${esc(boat.id)}">Edit listing</a></div><div class="fleet-calendar-layout"><section class="profile-panel fleet-calendar-panel">${calendarMonthContent(boat,bookings,blocks,selectedMonth)}</section><aside class="fleet-calendar-side"><section class="profile-panel"><h3>Block dates</h3><p class="member-note">Stop new bookings for maintenance, private use or other commitments.</p><form class="live-form" data-live-form="block" data-id="${esc(boat.id)}">${calendarDateFields()}<button class="btn" type="submit">Block selected dates</button><p data-feedback role="status"></p></form></section><section class="profile-panel"><h3>Blocked periods</h3>${boatBlocks.length?boatBlocks.map(b=>`<div class="fleet-block-row"><span>${esc(euroRange(b.start_date,b.end_date))}</span>${btn('Unblock','unblock',b.id)}</div>`).join(''):'<p class="member-note">No dates manually blocked.</p>'}</section><section class="profile-panel"><h3>Guest activity</h3><p class="member-note">${upcoming.filter(r=>r.status==='pending_owner').length} requests awaiting your reply. Reserved dates are shown on the calendar.</p><a href="#/owner?view=requests">Manage booking requests ${icon('arrow')}</a></section></aside></div></div>`;
  }
  function ownerCalendar(...args){
    const [boat,bookings,blocks]=args;
    if(boat){
      if(calendarSelection&&calendarSelection.boatId!==boat.id)calendarSelection=null;
      calendarContext={boat,bookings,blocks};
      calendarUnavailable=[...bookings.filter(r=>['pending_owner','awaiting_payment','confirmed'].includes(r.status)),...blocks].map(r=>({start:r.start_date,end:r.end_date}));
    }
    return ownerCalendarBase(...args).replace('Stop new bookings for maintenance, private use or other commitments.','Select dates on the calendar: click two days or drag across a range, then confirm below. You can also enter dates manually.');
  }
  function boatFormBase(b={}) {
    const canPublish=ownerVerificationState()==='approved';
    const both=!!b.with_skipper&&b.without_skipper!==false;
    return `<div class="fleet-editor-page"><div class="fleet-editor-header"><div><a class="fleet-back" href="#/owner">← Back to My Boats</a><span class="member-eyebrow">BOAT SETUP</span><h2>${b.id?esc(b.name):'List your boat'}</h2><p>Everything guests need to know, organised into four quick steps.</p><span class="fleet-editor-state ${b.published?'published':'draft'}">${b.published?'● Published listing':'○ Draft listing'}</span></div>${b.id?`<a class="btn live-secondary" href="#/owner?view=calendar&boat=${esc(b.id)}">${icon('calendar')} Manage calendar</a>`:''}</div><form data-live-form="boat" data-id="${esc(b.id||'')}" class="fleet-editor-form live-form" novalidate><nav class="fleet-editor-navigation" aria-label="Listing setup steps"><button type="button" data-live="boat-step" data-step="1" aria-current="step"><b>1</b> Boat & location</button><button type="button" data-live="boat-step" data-step="2"><b>2</b> Price & skipper</button><button type="button" data-live="boat-step" data-step="3"><b>3</b> Photos & details</button><button type="button" data-live="boat-step" data-step="4"><b>4</b> Publish</button></nav><div class="fleet-editor-fields"><section class="profile-panel fleet-editor-section" id="boat-basics" data-editor-step="1"><div class="fleet-editor-section-heading"><span>01</span><div><h3>Boat details</h3><p>Help customers find the right boat.</p></div></div>${field('Boat name','name','text',b.name||'','required maxlength="120" placeholder="e.g. Quicksilver 755 Sundeck"')}<div class="live-columns">${field('Country','country','text',b.country||'','required maxlength="80"')}${field('Marina / location','location','text',b.location||'','required maxlength="160"')}</div><div class="live-columns"><label>Boat type<select name="type">${['Motorboat','RIB','Sailboat','Catamaran','Yacht','Jetski'].map(t=>`<option ${t===b.type?'selected':''}>${t}</option>`).join('')}</select></label>${field('Maximum guests','guests','number',b.guests||1,'required min="1" max="100"')}</div></section><section class="profile-panel fleet-editor-section" id="boat-rental" data-editor-step="2" hidden><div class="fleet-editor-section-heading"><span>02</span><div><h3>Pricing & skipper</h3><p>Be clear about what guests pay and who drives the boat.</p></div></div>${field('Boat price per day (€)','price','number',b.price||'','required min="1" max="100000" step="0.01"')}<fieldset class="fleet-rental-modes"><legend>Available rental options</legend><label class="live-check"><input type="checkbox" name="with_skipper" ${b.with_skipper?'checked':''}> <span><strong>Rent with skipper</strong><small>A qualified skipper operates the boat. Guests need no driving licence verification.</small></span></label><label class="live-check"><input type="checkbox" name="without_skipper" ${b.without_skipper!==false?'checked':''}> <span><strong>Rent without skipper</strong><small>Guests must have verified identification and boat licence.</small></span></label></fieldset><div class="fleet-skipper-fee" data-skipper-fee-wrapper>${field('Additional skipper fee per day (€)','skipper_fee_per_day','number',b.skipper_fee_per_day||0,`min="0" max="10000" step="0.01" ${both?'required':''} ${both?'':'disabled'}`)}<p data-skipper-fee-note class="member-note">${both?'Paid directly to the skipper at check-in by cash or card. Get By Boat takes no commission on this fee.':'If this boat is rented only with a skipper, the skipper is included in the boat price. An extra fee is not charged.'}</p></div><p class="fleet-editor-hint">Check-in is at 09:00 and check-out at 19:00 for daily rentals.</p></section><section class="profile-panel fleet-editor-section" id="boat-description" data-editor-step="3" hidden><div class="fleet-editor-section-heading"><span>03</span><div><h3>Description & cover photo</h3><p>Show guests why they should choose your boat.</p></div></div><label>Boat description<textarea name="description" maxlength="10000" rows="6" placeholder="Tell guests about the boat, equipment, suggested routes and what is included.">${esc(b.description||'')}</textarea></label>${b.photo_url&&photo(b.photo_url)?`<div class="fleet-existing-photo"><img src="${esc(photo(b.photo_url))}" alt="Current boat cover photo"><span>Current cover photo</span></div>`:''}<label>Upload cover photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><p class="member-note">JPEG, PNG or WebP, maximum 5 MB. A new upload replaces the cover photo.</p></section><section class="profile-panel fleet-editor-section" id="boat-publishing" data-editor-step="4" hidden><div class="fleet-editor-section-heading"><span>04</span><div><h3>Publication status</h3><p>Choose whether customers can discover this boat.</p></div></div><label class="live-check fleet-publish-toggle"><input type="checkbox" name="published" ${b.published?'checked':''} ${!canPublish&&!b.published?'disabled':''}> <span><strong>Publish this listing</strong><small>Uncheck to save privately as a draft or pause new bookings.</small></span></label>${!canPublish?`<p class="verification-warning">${b.published?'This existing listing can stay live; republishing requires verification.':'You can save a draft now. Publishing requires approved owner verification.'} <a href="#/account?tab=business">Complete business verification</a>.</p>`:''}<p class="member-note">All booking requests require your acceptance. Existing bookings are not cancelled when you unpublish a boat.</p></section><div class="fleet-editor-save"><span data-editor-progress>Step 1 of 4 · Boat & location</span><div class="fleet-editor-actions"><button class="fleet-step-secondary" type="button" data-live="boat-prev" hidden>Back</button><button class="fleet-step-secondary" type="button" data-live="boat-next">Next step →</button><button class="btn" type="submit">${b.id?'Save changes':'Save boat'}</button></div><p data-feedback role="status"></p></div></div></form></div>`;
  }
  function boatForm(b={}){
    const s=b.specifications||{},hasSpecs=Object.values(s).some(v=>v!==''&&v!==null&&v!==undefined);
    const both=!!b.with_skipper&&b.without_skipper!==false;
    const types=[['','Not specified'],['outboard','Outboard'],['inboard','Inboard'],['electric','Electric'],['none','No engine'],['other','Other']];
    const insuranceTypes=[['not_specified','Not specified'],['none','Not insured'],['third_party','Third-party insurance'],['comprehensive','Fully comprehensive']];
    const optionalSelect=(name,label,options,value)=>`<label>${esc(label)}<select name="${name}">${options.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
    const number=(label,name,value,max,step='1')=>field(label,name,'number',value??'',`min="0" max="${max}" step="${step}" placeholder="Optional"`);
    const technical=`<details class="fleet-optional-panel" ${hasSpecs?'open':''}><summary><span>${icon('ship')} Technical specifications</span><small>Optional · engine, dimensions & performance</small></summary><div class="fleet-optional-content"><p class="member-note">Add what you know. Leave the rest blank; guests can still book your boat.</p><div class="live-columns">${optionalSelect('spec_engine_type','Engine type',types,s.engine_type||'')}${number('Total engine horsepower (hp)','spec_engine_hp',s.engine_hp,50000)}</div><div class="live-columns">${number('Boat length (m)','spec_length_m',s.length_m,200,'0.01')}${number('Boat width (m)','spec_width_m',s.width_m,100,'0.01')}</div><div class="live-columns">${number('Draft (m)','spec_draft_m',s.draft_m,50,'0.01')}${number('Year built','spec_build_year',s.build_year,2100)}</div><div class="live-columns">${number('Fuel consumption (L/h)','spec_fuel_lph',s.fuel_lph,10000,'0.1')}${number('Top speed (knots)','spec_speed_knots',s.speed_knots,200,'0.1')}</div><div class="live-columns">${number('Crew members (if included)','spec_crew',s.crew,100)}</div></div></details>`;
    const insurance=`<details class="fleet-optional-panel" ${b.insurance_type&&b.insurance_type!=='not_specified'||Number(b.security_deposit)>0?'open':''}><summary><span>${icon('shield')} Insurance & security deposit</span><small>Optional · coverage and refundable deposit</small></summary><div class="fleet-optional-content"><p class="member-note">Choose the insurance coverage and refundable deposit applicable to this boat.</p><div class="live-columns">${optionalSelect('insurance_type','Insurance coverage',insuranceTypes,b.insurance_type||'not_specified')}${number('Refundable security deposit (€)','security_deposit',b.security_deposit??0,100000,'0.01')}</div></div></details>`;
    const closing='</section><section class="profile-panel fleet-editor-section" id="boat-publishing"';
    const canPublish=ownerVerificationState()==='approved',willPublish=canPublish||!!b.published;
    const countryField=field('Country','country','text',b.country||'','required maxlength="80"');
    const countries=`<label>Country<input name="country" type="text" value="${esc(b.country==='United States'?'USA':b.country||'')}" required maxlength="80" list="boat-countries" autocomplete="off" placeholder="Start typing a country in English"><datalist id="boat-countries">${countryLabels.map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist></label>`;
    const pickup=String(b.pickup_location||b.location||'');
    const pickupCoordinates=boatPickupCoordinates(b);
    const pickupFields=`<div class="fleet-pickup"><h4>Where will guests pick up the boat?</h4>${field('Pickup point / meeting address','pickup_location','text',pickup,'required maxlength="240" placeholder="e.g. Marina Hramina, pier A"')}<div class="fleet-pickup-actions"><button class="btn live-secondary" type="button" data-pickup-preview>Jump to selected country</button><small>Zoom in, drag the pin or click the exact marina on the map.</small></div><div class="fleet-pickup-map" data-pickup-map aria-label="Interactive pickup map with a draggable pin"></div><p class="fleet-pickup-status" data-pickup-status role="status"></p><details class="fleet-pickup-manual"><summary>Enter coordinates manually (optional)</summary><div class="live-columns">${field('Latitude','pickup_latitude','number',pickupCoordinates?pickupCoordinates[0]:'','min="-90" max="90" step="any" placeholder="e.g. 43.819"')}${field('Longitude','pickup_longitude','number',pickupCoordinates?pickupCoordinates[1]:'','min="-180" max="180" step="any" placeholder="e.g. 15.592"')}</div></details></div>`;
    return boatFormBase(b)
      .replace('organised into four quick steps','organised into three quick steps')
      .replace('<button type="button" data-live="boat-step" data-step="4"><b>4</b> Publish</button>','')
      .replace(countryField,countries)
      .replace('<div class="live-columns"><label>Boat type',pickupFields+'<div class="live-columns"><label>Boat type')
      .replace('Maximum guests','Maximum Passengers')
      .replace('Boat price per day (€)','Your payout per day (€)')
      .replace('<fieldset class="fleet-rental-modes">',`<p class="fleet-guest-rate" data-guest-price-preview>Guests see <strong>${money(guestDailyRate(b.price||0))} / day</strong> (your rate + 7% Get By Boat commission).</p><fieldset class="fleet-rental-modes">`)
      .replace('</fieldset><div class="fleet-skipper-fee"',`<button type="button" class="fleet-offer-both" data-rental-both>✓ Offer both rental options</button><p class="fleet-rental-summary" data-rental-mode-summary></p></fieldset><div class="fleet-skipper-fee"`)
      .replace('Additional skipper fee per day (€)','Skipper price per day (€)')
      .replace(`min="0" max="10000" step="0.01" ${both?'required':''} ${both?'':'disabled'}`,`min="${b.with_skipper?'0.01':'0'}" max="10000" step="0.01" ${b.with_skipper?'required':''} ${b.with_skipper?'':'disabled'}`)
      .replace('data-skipper-fee-wrapper>','data-skipper-fee-wrapper '+(b.with_skipper?'':'hidden')+'>')
      .replace(closing,technical+insurance+closing)
      .replace(/<section class="profile-panel fleet-editor-section" id="boat-publishing"[\s\S]*?<\/section>/,'')
      .replace('<div class="fleet-editor-save">',`<input type="hidden" name="published" value="${willPublish?'on':''}"><div class="fleet-editor-save">`)
      .replace('Step 1 of 4 · Boat & location','Step 1 of 3 · Boat & location')
      .replace(/<button class="btn" type="submit">(?:Save changes|Save boat)<\/button>/,`<button class="btn" type="submit">${willPublish?'Publish':'Save draft'}</button>`)
      .replace('<p data-feedback role="status"></p></div></div></form>',`${!willPublish?'<p class="verification-warning">To publish, complete your <a href="#/account?tab=business">owner verification</a>. Your boat will be saved as a draft until approval.</p>':''}<p data-feedback role="status"></p></div></div></form>`);
  }
  function requests(rows,owner=false){return rows.length?rows.map(r=>`<article class="live-card"><span class="live-status">${esc(status(r.status))}</span><h3>${esc(r.boats?.name||'Boat reservation')}</h3><p>${esc(euroRange(r.start_date,r.end_date))} · 09:00–19:00 each day · ${r.guests} passengers</p><p><strong>${r.with_skipper?'Rent with skipper':'Rent without skipper'}</strong></p>${owner?`<p>Guest: ${esc(r.customer_name)}</p><p>Owner charter: ${money(r.charter_price)} · Get By Boat commission: ${money(r.service_fee)} · Guest total: <strong>${money(r.total)}</strong></p>`:`<p><strong>Total boat price: ${money(r.total)}</strong></p>`}${r.with_skipper&&Number(r.skipper_fee_total)>0?`<p class="fleet-quote-extra">Skipper: <strong>${money(r.skipper_fee_total)}</strong> paid directly at check-in in cash or by card (not included in the booking total).</p>`:r.with_skipper?`<p class="fleet-quote-extra">Skipper included in the boat price.</p>`:'' }<small>Request ${esc(r.id)}</small><div class="live-actions"><a class="btn live-secondary" href="#/messages?booking=${esc(r.id)}">${icon('message')} ${owner?'Message guest':'Message owner'}</a>${owner&&r.status==='pending_owner'?btn('Accept request','accept',r.id)+btn('Decline','decline',r.id):''}${!owner&&['pending_owner','awaiting_payment'].includes(r.status)?btn('Cancel request','cancel',r.id):''}</div>${r.status==='awaiting_payment'?'<p>Your dates are held. Online payment is not available yet. This is not a paid, confirmed booking.</p>':''}</article>`).join(''):'<div class="live-card"><p>No booking requests yet.</p></div>'}
  async function messagesPage(requestedId){
    // Booking RLS filters this to bookings in which the signed-in user participates.
    const rows=check(await client.from('bookings').select('id,customer_id,boat_id,customer_name,start_date,end_date,with_skipper,status,created_at,boats(name,owner_id)').order('created_at',{ascending:false}).limit(100));
    if(!rows.length)return page('Messages',`<div class="member-empty"><h2>No conversations yet</h2><p>A private conversation begins as soon as a guest sends a booking request.</p><a class="btn" href="${profile?.account_type==='owner'?'#/owner':'#/boats'}">${profile?.account_type==='owner'?'Manage my boats':'Explore boats'}</a></div>`);
    const selected=rows.find(r=>r.id===requestedId)||rows[0];
    const messages=check(await client.from('booking_messages').select('id,booking_id,sender_id,content,created_at,read_at').eq('booking_id',selected.id).order('created_at',{ascending:true}).limit(200));
    const editable=['pending_owner','awaiting_payment','confirmed'].includes(selected.status);
    const mine=session.user.id;
    // Only recipients can mark messages read; an insert or edit never changes sender/content.
    if(messages.some(m=>m.sender_id!==mine&&!m.read_at))client.from('booking_messages').update({read_at:new Date().toISOString()}).eq('booking_id',selected.id).neq('sender_id',mine).is('read_at',null).then(()=>{});
    const conversations=rows.map(r=>`<a href="#/messages?booking=${esc(r.id)}" class="booking-conversation ${r.id===selected.id?'selected':''}" ${r.id===selected.id?'aria-current="page"':''}><span class="booking-conversation-icon">${icon('ship')}</span><span><strong>${esc(r.customer_name||'Guest')}</strong><small>${esc(r.boats?.name||'Boat booking')} · ${esc(euroRange(r.start_date,r.end_date))}</small><small>${esc(status(r.status))}</small></span>${icon('arrow')}</a>`).join('');
    const bubbles=messages.map(m=>`<div class="booking-message ${m.sender_id===mine?'outgoing':'incoming'}"><div class="booking-message-bubble"><p>${esc(m.content).replace(/\n/g,'<br>')}</p><small>${esc(new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}${m.sender_id===mine&&m.read_at?' · Read':''}</small></div></div>`).join('');
    const compose=editable?`<form data-live-form="message" data-id="${esc(selected.id)}" class="booking-compose"><label for="booking-message-input">Your message</label><textarea id="booking-message-input" name="content" rows="2" minlength="1" maxlength="2000" placeholder="Ask about the meeting point, arrival time or trip details…" required></textarea><div class="booking-compose-actions"><span>Private to you and the ${profile?.account_type==='owner'?'guest':'owner'} · 2,000 characters max.</span><button class="btn" type="submit">Send message ${icon('arrow')}</button></div><p role="status" data-feedback></p></form>`:`<p class="booking-chat-closed">This booking is ${esc(status(selected.status).toLowerCase())}. The conversation is read-only.</p>`;
    return page('Messages',`<p class="member-note">Your private conversations about booking requests. Only the renter and boat owner can access each thread.</p><div class="booking-messenger"><aside class="booking-conversations"><h2>Conversations <span>${rows.length}</span></h2>${conversations}</aside><section class="booking-chat" data-booking-id="${esc(selected.id)}"><div class="booking-chat-heading"><div><span class="member-eyebrow">BOOKING CONVERSATION</span><h2>${esc(selected.customer_name||'Guest')} · ${esc(selected.boats?.name||'Boat booking')}</h2><p>${esc(euroRange(selected.start_date,selected.end_date))} · ${selected.with_skipper?'With skipper':'Without skipper'}</p></div><span class="live-status">${esc(status(selected.status))}</span></div><div class="booking-thread" role="log" aria-label="Booking messages">${bubbles||'<div class="booking-thread-empty">No messages yet. Say hello and agree on trip details here.</div>'}</div>${compose}</section></div>`);
  }
  function syncChatSubscription(){
    const bookingId=document.querySelector('.booking-chat')?.dataset.bookingId||'';
    if(bookingId===chatBookingId)return;
    if(chatChannel){client?.removeChannel(chatChannel);chatChannel=null;}
    chatBookingId=bookingId;
    if(!bookingId||!client?.channel)return;
    chatChannel=client.channel('booking-chat-'+bookingId).on('postgres_changes',{event:'INSERT',schema:'public',table:'booking_messages',filter:'booking_id=eq.'+bookingId},()=>{if(document.querySelector('.booking-chat')?.dataset.bookingId===bookingId)render();}).subscribe();
  }
  // Notifications are best effort. A failure never blocks booking requests or chat messages.
  function notifyBookingEmail(eventType,bookingId,messageId){
    if(!client?.functions?.invoke)return;
    client.functions.invoke('booking-email',{body:{event_type:eventType,booking_id:bookingId,...(messageId?{message_id:messageId}:{})}}).then(({error})=>{if(error)console.warn('Booking email pending:',error.message);}).catch(error=>console.warn('Booking email pending:',error.message));
  }
  function dashboardHome(rows,boats){
    const name=esc((profile.display_name||'Traveller').split(' ')[0]);
    const pending=rows.filter(r=>r.status==='pending_owner'||r.status==='awaiting_payment').length;
    const profileSteps=[!!avatarUrl,verificationState()==='approved'].filter(Boolean).length;
    const bookingCards=rows.length?rows.slice(0,2).map(r=>`<a class="member-booking-preview" href="#/bookings"><div class="member-booking-icon">${icon('ship')}</div><div><strong>${esc(r.boats?.name||'Boat rental')}</strong><span>${esc(r.start_date)} – ${esc(r.end_date)} · ${esc(r.guests)} guests</span></div><span class="member-status">${esc(status(r.status))}</span>${icon('arrow')}</a>`).join(''):`<div class="member-card-empty"><span class="member-empty-symbol">${icon('ship')}</span><h3>No trips booked yet</h3><p>Your next unforgettable day on the water is waiting.</p><a class="member-inline-link" href="#/boats">Explore boats ${icon('arrow')}</a></div>`;
    return `<div class="member-dashboard"><div class="member-hero"><div class="member-hero-copy"><span class="member-eyebrow">YOUR PERSONAL SPACE · GET BY BOAT</span><h1>Welcome aboard,<br><em>${name}.</em></h1><a class="btn member-hero-btn" href="#/boats">Explore boats ${icon('arrow')}</a></div><div class="member-hero-image" aria-hidden="true"></div></div>
      <div class="member-stats"><a href="#/bookings" class="member-stat"><span>${icon('calendar')} Total requests</span><strong>${rows.length}</strong><small>View your booking history ${icon('arrow')}</small></a><a href="#/bookings" class="member-stat"><span>${icon('clock')} Awaiting updates</span><strong>${pending}</strong><small>Check request status ${icon('arrow')}</small></a><a href="#/account?tab=verification" class="member-stat"><span>${icon('shield')} Profile essentials</span><strong>${profileSteps}<small> / 2</small></strong><small>Verify your account ${icon('arrow')}</small></a></div>
      <div class="member-dashboard-columns"><section class="member-panel"><div class="member-panel-head"><div><span class="member-eyebrow">YOUR JOURNEYS</span><h2>Booking requests</h2></div><a href="#/bookings">View all ${icon('arrow')}</a></div>${bookingCards}</section>
      <aside class="member-panel member-profile-panel"><div class="member-panel-head"><div><span class="member-eyebrow">A LITTLE ABOUT YOU</span><h2>Your profile</h2></div></div><p class="member-panel-intro">A complete profile makes every booking easier.</p><div class="member-profile-task"><span class="${avatarUrl?'done':''}">${avatarUrl?icon('check'):icon('user')}</span><div><strong>Profile photo</strong><small>${avatarUrl?'Added to your account':'Let owners recognise you'}</small></div><a href="#/account?tab=information">${avatarUrl?'Edit':'Add'}</a></div><div class="member-profile-task"><span class="${verificationState()==='approved'?'done':''}">${verificationState()==='approved'?icon('check'):icon('shield')}</span><div><strong>ID & boat licence</strong><small>${esc(verificationLabel(verificationState()))}</small></div><a href="#/account?tab=verification">${verificationState()==='approved'?'View':'Verify'}</a></div><a class="member-outline-action" href="#/account?tab=verification">Go to verification ${icon('arrow')}</a></aside></div>
      </div>`;
  }
  function ownerDashboardHome(boats,rows){
    const name=esc((profile.display_name||'Captain').split(' ')[0]);
    const pending=rows.filter(r=>r.status==='pending_owner').length;
    return `<div class="member-dashboard">${ownerVerificationState()==='approved'?'<div class="verification-good">Your owner account is verified. You can publish new boat listings.</div>':`<div class="verification-warning">Owner verification: <strong>${esc(verificationLabel(ownerVerificationState()))}</strong>. Create drafts now, then <a href="#/account?tab=verification">submit business documents</a> to publish boats.</div>`}<div class="member-hero"><div class="member-hero-copy"><span class="member-eyebrow">YOUR OWNER SPACE · GET BY BOAT</span><h1>Welcome aboard,<br><em>${name}.</em></h1><a class="btn member-hero-btn" href="#/owner?edit=new">List a boat ${icon('arrow')}</a></div><div class="member-hero-image" aria-hidden="true"></div></div>
      <div class="member-stats"><a href="#/owner" class="member-stat"><span>${icon('ship')} Your boats</span><strong>${boats.length}</strong><small>Manage your listings ${icon('arrow')}</small></a><a href="#/owner?view=requests" class="member-stat"><span>${icon('mail')} Guest requests</span><strong>${rows.length}</strong><small>View all requests ${icon('arrow')}</small></a><a href="#/owner?view=requests" class="member-stat"><span>${icon('clock')} Awaiting response</span><strong>${pending}</strong><small>Reply to your guests ${icon('arrow')}</small></a></div>
      <div class="member-dashboard-columns"><section class="member-panel"><div class="member-panel-head"><div><span class="member-eyebrow">YOUR FLEET</span><h2>My boats</h2></div><a href="#/owner">Manage all ${icon('arrow')}</a></div>${boats.length?boats.slice(0,3).map(b=>`<a class="member-booking-preview" href="#/owner?edit=${b.id}"><div class="member-booking-icon">${icon('ship')}</div><div><strong>${esc(b.name)}</strong><span>${esc(b.location)} · ${b.published?'Published':'Draft'}</span></div>${icon('arrow')}</a>`).join(''):`<div class="member-card-empty"><h3>Your first boat is waiting</h3><p>Create a listing and start welcoming guests.</p><a class="member-inline-link" href="#/owner?edit=new">List your boat ${icon('arrow')}</a></div>`}</section>
      <aside class="member-panel member-profile-panel"><div class="member-panel-head"><div><span class="member-eyebrow">GUESTS ABOARD</span><h2>Booking requests</h2></div></div><p class="member-panel-intro">${pending} ${pending===1?'request needs':'requests need'} your response.</p><a class="member-outline-action" href="#/owner?view=requests">Manage guest requests ${icon('arrow')}</a><p class="member-note">Owner accounts can list boats and manage requests. To rent a boat yourself, use a separate customer account.</p></aside></div></div>`;
  }
  async function staffPage(){
    if(!verificationStaff)return page('Staff verification','<div class="profile-panel"><h2>Access restricted</h2><p>Only authorised Get By Boat reviewers can access private verification documents.</p></div>');
    const rows=check(await client.from('verification_requests').select('*').order('submitted_at',{ascending:false}).limit(50));
    const reviews=rows.length?check(await client.from('verification_reviews').select('*').in('user_id',rows.map(r=>r.user_id))):[];
    const profiles=rows.length?check(await client.from('profiles').select('id,display_name,details').in('id',rows.map(r=>r.user_id))):[];
    const cards=await Promise.all(rows.map(async r=>{
      const p=profiles.find(x=>x.id===r.user_id),review=reviews.find(x=>x.user_id===r.user_id);
      const current=review?.identity_path===r.identity_path && review?.licence_path===r.licence_path && review?.reviewed_birth_date===r.birth_date && review?.reviewed_licence_type===r.licence_type && review?.reviewed_licence_expiry===r.licence_expiry && review?.reviewed_name?.trim().toLocaleLowerCase()===p?.display_name?.trim().toLocaleLowerCase();
      const status=current?review.status:'pending';
      const [idFile,licenceFile]=current&&['approved','rejected'].includes(status)?[null,null]:await Promise.all([client.storage.from('verification-documents').createSignedUrl(r.identity_path,300),client.storage.from('verification-documents').createSignedUrl(r.licence_path,300)]);
      const documentLink=(result,label)=>!result?`<span class="member-note">${esc(label)}: reviewed; copy scheduled for removal</span>`:result.error?`<span class="member-note">${esc(label)} unavailable (may have been deleted after review)</span>`:`<a class="member-outline-action" target="_blank" rel="noopener noreferrer" href="${esc(result.data.signedUrl)}">View ${esc(label)} · 5-minute link ${icon('arrow')}</a>`;
      return `<article class="profile-panel verification-staff-card"><div class="verification-heading"><div><h2>${esc(p?.display_name||'Customer')}</h2><p>Submitted ${esc(r.submitted_at?.slice(0,10)||'')} · DOB ${esc(r.birth_date)}</p></div><span class="verification-badge ${esc(status)}">${esc(verificationLabel(status))}</span></div><p><strong>Identity:</strong> ${r.identity_type==='passport'?'Passport':'National ID'} · <strong>Licence:</strong> ${esc(r.licence_type)} · <strong>Expiry:</strong> ${esc(r.licence_expiry||'Permanent / not specified')}</p>${p?.details?.birth_date?`<p>Customer profile date of birth: ${esc(p.details.birth_date)}</p>`:''}<div class="verification-document-links">${documentLink(idFile,'ID / passport')}${documentLink(licenceFile,'boat driving licence')}</div>${current&&review?.note?`<p>Previous decision note: ${esc(review.note)}</p>`:''}<form class="live-form verification-review-form" data-live-form="review" data-id="${esc(r.user_id)}"><label>Decision<select name="status" required><option value="approved">Approve documents</option><option value="rejected">Reject / request correction</option></select></label><label class="live-check"><input type="checkbox" name="identity_matches"> I checked that the ID/passport is genuine-looking and matches the customer's legal name and date of birth.</label><label class="live-check"><input type="checkbox" name="licence_matches"> I checked the licence holder matches the ID/passport, and the licence category and validity are suitable.</label><label>Message to customer (required if rejected)<textarea name="note" rows="2" maxlength="1000" placeholder="Explain which details need correction."></textarea></label><button class="btn" type="submit">Save review decision</button><p role="status" data-feedback></p></form></article>`;
    }));
    const ownerRows=check(await client.from('owner_verification_requests').select('*').eq('application_state','submitted').order('submitted_at',{ascending:false}).limit(50));
    const ownerReviews=ownerRows.length?check(await client.from('owner_verification_reviews').select('*').in('user_id',ownerRows.map(r=>r.user_id))):[];
    const ownerProfiles=ownerRows.length?check(await client.from('profiles').select('id,display_name').in('id',ownerRows.map(r=>r.user_id))):[];
    const ownerCards=await Promise.all(ownerRows.map(async r=>{
      const p=ownerProfiles.find(x=>x.id===r.user_id),review=ownerReviews.find(x=>x.user_id===r.user_id);
      const isCurrent=ownerReviewIsCurrent(r,review,p?.display_name),s=isCurrent?review.status:'pending';
      const paths=[['Registration',r.registration_path],['ID / passport',r.identity_path],['Bank / IBAN proof',r.iban_proof_path]];
      const signed=await Promise.all(paths.map(async ([label,path])=>{
        const result=await client.storage.from('owner-verification-documents').createSignedUrl(path,300);
        return result.error?`<span class="member-note">${esc(label)} unavailable</span>`:`<a href="${esc(result.data.signedUrl)}" target="_blank" rel="noopener noreferrer" class="member-outline-action">View ${esc(label)} · 5-minute link ${icon('arrow')}</a>`;
      }));
      return `<article class="profile-panel verification-staff-card"><div class="verification-heading"><div><h2>${esc(r.legal_business_name)}</h2><p>Owner: ${esc(p?.display_name||'Unknown')} · Submitted ${esc(r.submitted_at?.slice(0,10)||'')}</p></div><span class="verification-badge ${esc(s)}">${esc(verificationLabel(s))}</span></div><p><strong>Country / registration:</strong> ${esc(r.business_country)} · ${esc(r.tax_identifier)}<br><strong>Registered address:</strong> ${esc(r.registered_address)}<br><strong>Website:</strong> <a href="${esc(r.business_website)}" target="_blank" rel="noopener noreferrer">${esc(r.business_website)}</a><br><strong>IBAN:</strong> ${esc(r.iban)} · ${esc(r.iban_holder)}<br><strong>Identity document:</strong> ${r.identity_type==='passport'?'Passport':'National ID'}</p><div class="verification-document-links">${signed.join('')}</div>${isCurrent&&review?.note?`<p>Previous decision note: ${esc(review.note)}</p>`:''}<form class="live-form verification-review-form" data-live-form="owner-review" data-id="${esc(r.user_id)}"><label>Decision<select name="status" required><option value="approved">Approve business</option><option value="rejected">Reject / request correction</option></select></label><label class="live-check"><input type="checkbox" name="registration_matches"> I checked the business registration, country and registration number (OIB / SIRET / other).</label><label class="live-check"><input type="checkbox" name="identity_matches"> I checked the owner / manager identity and authority to represent the business.</label><label class="live-check"><input type="checkbox" name="bank_matches"> I checked that the business IBAN belongs to the registered business and verified its website and address.</label><label>Message to owner (required if rejected)<textarea name="note" rows="2" maxlength="1000" placeholder="Explain what needs correction"></textarea></label><button class="btn" type="submit">Save owner verification</button><p role="status" data-feedback></p></form></article>`;
    }));
    return page('Staff verification',`<p>Restricted reviewer area. Documents are private and accessible only through short-lived signed links. Approving owners unlocks publication of new listings.</p><h2>Business / owner verification (${ownerRows.length})</h2><div class="verification-staff-list">${ownerCards.join('')||'<div class="profile-panel">No owner verification requests yet.</div>'}</div><h2>Customer ID & boat licence (${rows.length})</h2><div class="verification-staff-list">${cards.join('')||'<div class="profile-panel">No customer verification requests yet.</div>'}</div>`);
  }
  async function route(){const {path,params}=parseRoute();if(!['/boats','/owner','/bookings','/account','/login','/dashboard','/favourites','/staff','/messages'].includes(path)&&!path.startsWith('/listing/'))return null;
    if(!client)return ['/login','/owner','/bookings','/account','/dashboard','/favourites','/staff','/messages'].includes(path)?loginPage():page('Welcome aboard.','<p>Connecting your account…</p>');
    if(path==='/login'&&session&&!recovery){location.hash=afterLogin();return !profile?profileDialog(authNext):page('Welcome back.','<p>Opening your account…</p>')}
    if(path==='/login')return loginPage();
    if(path==='/owner'&&!session)return loginPage();
    if(path==='/boats') {const boats=check(await client.from('boats').select('*').eq('published',true).order('created_at',{ascending:false}));const search=(params.get('location')||params.get('country')||'').toLowerCase(),type=params.get('type')||'';const filtered=boats.filter(b=>(!search||`${b.location} ${b.country}`.toLowerCase().includes(search))&&(!type||b.type===type));return page('Discover your next <i>adventure.</i>',`<form data-live-form="search" class="live-card live-search">${field('Where would you like to go?','location','search',search)}<label>Boat type<select name="type"><option value="">Any boat</option>${['Motorboat','RIB','Sailboat','Catamaran','Yacht','Jetski'].map(t=>`<option ${t===type?'selected':''}>${t}</option>`).join('')}</select></label><button class="btn">Search</button></form><p>${filtered.length} ${filtered.length===1?'boat':'boats'} · All bookings upon request</p><div class="live-grid">${filtered.map(b=>`<a class="live-card live-boat" href="#/listing/${b.id}">${picture(b)}<h2>${esc(b.name)}</h2><p>${esc(b.location)}, ${esc(b.country)} · ${esc(b.type)} · ${b.guests} passengers</p><p class="rental-mode-summary">${esc(rentalOptions(b))}</p><strong>${money(guestDailyRate(b.price))} / day</strong></a>`).join('')||`<div class="live-card"><h2>Our next chapter is coming.</h2><p>No published boats match this search yet. Boat owners can add their listings from the owner space.</p>${profile?.account_type!=='customer'?'<a href="#/owner" class="btn">List your boat</a>':''}</div>`}</div>`)}
    if(path.startsWith('/listing/')) {
      for(const [key,name] of [['start','start'],['end','end']]){const value=params.get(key);if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))state[name]=value;}
      const selectedGuests=Math.max(1,Math.min(100,Number(params.get('guests'))||1));
      const b=check(await client.from('boats').select('*').eq('id',path.slice(9)).single());
      let unavailable=[];if(session)unavailable=check(await client.rpc('boat_availability',{p_boat:b.id}));
      const isOwner=profile?.account_type==='owner',hasSkipper=b.with_skipper===true,hasBareboat=b.without_skipper!==false;
      const preferred=params.get('skipper')==='without'?'without':params.get('skipper')==='with'?'with':null;
      const mode=preferred==='with'&&hasSkipper?'with':preferred==='without'&&hasBareboat?'without':hasSkipper?'with':'without';
      const needsVerification=session&&!isOwner&&mode==='without'&&(verificationState()!=='approved'||!!(verificationRequest?.licence_expiry&&state.end&&state.end>verificationRequest.licence_expiry));
      const choices=`<label>Rental option<select name="skipper" required>${hasSkipper?`<option value="with" ${mode==='with'?'selected':''}>Rent with skipper</option>`:''}${hasBareboat?`<option value="without" ${mode==='without'?'selected':''}>Rent without skipper</option>`:''}</select></label>`;
      const warning=`<div class="verification-booking-block" data-skipper-verification ${needsVerification?'':'hidden'}><strong>${icon('shield')} Licence verification required</strong><p>Renting without a skipper requires staff-approved ID/passport and boat driving licence, valid through the rental dates. ${esc(verificationLabel(verificationState()))}.</p><a href="#/account?tab=verification">Go to verification ${icon('arrow')}</a></div>`;
      return page(esc(b.name),`<div class="live-columns"><section>${picture(b)}${session&&!isOwner?btn('Save to favourites','favourite',b.id):''}<h2>${esc(b.location)}, ${esc(b.country)}</h2><p>${esc(b.type)} · ${b.guests} passengers</p><p class="rental-mode-summary">${esc(rentalOptions(b))}</p><p class="live-description">${esc(b.description)}</p>${pickupDetails(b)}</section><section>${isOwner?`<div class="live-card"><h2>Your payout: ${money(b.price)} / day</h2><p>Guest price: ${money(guestDailyRate(b.price))} / day including the 7% Get By Boat commission.</p><div class="verification-booking-block"><strong>Owner account · bookings unavailable</strong><p>Owner accounts can list boats and manage guest requests, but cannot rent or book boats. Use a separate customer account to rent a boat.</p></div><a class="btn" href="#/owner">Manage my boats</a></div>`:`<form data-live-form="request" data-id="${esc(b.id)}" data-price="${b.price}" data-with-skipper="${hasSkipper}" data-without-skipper="${hasBareboat}" data-skipper-fee="${Number(b.skipper_fee_per_day)||0}" data-skipper-extra="${hasBareboat&&hasSkipper}" data-verified="${verificationState()==='approved'}" data-licence-expiry="${esc(verificationRequest?.licence_expiry||'')}" class="live-card live-form"><h2>${money(guestDailyRate(b.price))} / day</h2><p>09:00–19:00 each rental day. Owner acceptance required.</p>${choices}<p class="member-note">With skipper: no ID or boat licence verification needed for the renter. Without skipper: both documents must be approved by staff.</p>${dateFields()}${field('Guests','guests','number',selectedGuests,`required min="1" max="${b.guests}"`)}<div data-quote aria-live="polite"></div>${warning}<button class="btn" type="submit" ${needsVerification?'disabled':''}>${needsVerification?'Verification required':session?'Send booking request':'Log in to request'}</button><p data-feedback role="status"></p><small>No payment is taken. Your request does not hold the dates until the owner accepts.</small></form>`}<div class="live-card"><h3>Unavailable dates</h3>${session?unavailable.map(d=>`<p>${esc(d.start_date)} — ${esc(d.end_date)}</p>`).join('')||'<p>No dates currently blocked.</p>':'<p>Log in to check availability.</p>'}</div></section></div>`);
    }
    const guard=requireAccount();if(guard)return guard;
    if(path==='/messages')return messagesPage(params.get('booking'));
    if(path==='/account')return page(profile?.account_type==='owner'?'Owner account':'Complete your profile',accountProfile(params.get('tab')||'information'));
    if(path==='/staff')return staffPage();
    if(path==='/dashboard'){
      if(profile.account_type==='owner'){
        const boats=check(await client.from('boats').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}));
        const requests=boats.length?check(await client.from('bookings').select('*,boats(name)').in('boat_id',boats.map(b=>b.id)).order('created_at',{ascending:false})):[];
        return page('Owner dashboard',ownerDashboardHome(boats,requests));
      }
      const rows=check(await client.from('bookings').select('*,boats(name)').eq('customer_id',session.user.id).order('created_at',{ascending:false}));
      return page('Dashboard',dashboardHome(rows,[]));
    }
    if(profile.account_type==='owner'&&['/favourites','/bookings'].includes(path))return page('Owner account',`<div class="profile-panel"><h2>Owner accounts cannot rent boats</h2><p>Your account is for listing boats and managing guests. To rent a boat, log out and create a separate customer account with a different email.</p><a class="btn" href="#/owner">Manage my boats</a></div>`);
    if(path==='/favourites'){
      const saved=check(await client.from('favourites').select('boat_id,boats(*)').eq('user_id',session.user.id));
      return page('Your favourites',saved.length?`<div class="live-grid">${saved.map(x=>`<article class="live-card">${x.boats?`${picture(x.boats)}<h2>${esc(x.boats.name)}</h2><a href="#/listing/${x.boat_id}">View boat</a>`:'<p>This boat is no longer available.</p>'}${btn('Remove','unfavourite',x.boat_id)}</article>`).join('')}</div>`:'<div class="member-empty"><p>Save the boats you love and find them here.</p><a href="#/boats">Explore boats →</a></div>');
    }
    if(path==='/bookings')return page('My bookings.',`<p>All your booking requests in one place. ${btn('Refresh','refresh')}</p>${requests(check(await client.from('bookings').select('*,boats(name)').eq('customer_id',session.user.id).order('created_at',{ascending:false})))}`);
    if(profile.account_type!=='owner')return page('Customer account',`<div class="profile-panel"><h2>Only boat owners can list boats</h2><p>Your customer account is for browsing and renting boats. To list your own boats, log out and create a separate boat owner account with a different email address. Account roles cannot be changed after sign-up.</p>${btn('Log out and create owner account','logout-owner')}</div>`);
    const boats=check(await client.from('boats').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}));
    const editing=params.get('edit');if(editing){
      const boat=boats.find(b=>b.id===editing)||{};
      return page('Edit boat',boatForm(boat));
    }
    const rows=boats.length?check(await client.from('bookings').select('*,boats(name)').in('boat_id',boats.map(b=>b.id)).order('created_at',{ascending:false})):[];
    if(params.get('view')==='requests')return page('Booking requests.',`<p>Accept or decline requests for your boats. ${btn('Refresh','refresh')}</p>${requests(rows,true)}`);
    const blocks=boats.length?check(await client.from('boat_blocks').select('*').in('boat_id',boats.map(b=>b.id)).order('start_date')):[];
    if(params.get('view')==='calendar')return page('Boat calendar',ownerCalendar(boats.find(b=>b.id===params.get('boat')),rows.filter(r=>r.boat_id===params.get('boat')),blocks.filter(b=>b.boat_id===params.get('boat')),params.get('month')));
    return page('My Boats',`<p class="fleet-owner-commission"><strong>Get By Boat commission: 7%</strong> · Your price is your payout. Customers see one final price, including the 7% markup.</p>`+ownerFleet(boats,rows,['published','drafts'].includes(params.get('filter'))?params.get('filter'):'all'));
  }
  const routes=p=>['/boats','/owner','/bookings','/account','/login','/dashboard','/favourites','/staff','/messages'].includes(p)||p.startsWith('/listing/');
  window.liveRender=()=>{
    const {path,params}=parseRoute();const token=++epoch;
    if(path==='/login'){authNext=safeNext(params.get('next')||(params.get('owner')==='1'||new URLSearchParams(location.search).get('owner')==='1'?'#/owner':'#/dashboard'))}
    else if(path==='/owner')authNext='#/owner';
    else if(path==='/staff')authNext='#/staff';
    else if(path==='/messages')authNext=safeNext(location.hash);
    else if(path==='/account')authNext=safeNext(params.get('next'));
    else if(path==='/bookings')authNext='#/bookings';
    ownerIntent=authNext==='#/owner';
    window.GBB_ACCOUNT_LINK=session?'#/dashboard':null;
    window.GBB_ACCOUNT_ROLE=profile?.account_type||null;
    const showProfile=false;
    const showAuth=path==='/login'||(!session&&['/owner','/bookings','/account','/dashboard','/favourites','/staff','/messages'].includes(path));
    if(showAuth){if(!authBackground)authBackground=returnRoute==='#/'?home():app.innerHTML||home()}
    else{returnRoute=location.hash||'#/';authBackground=null;document.body?.classList.remove('auth-open')}
    if(!routes(path))return false;
    // Keep the same dialog while Auth initializes; do not flash a second login design.
    if(ownerPickupMap){ownerPickupMap.map.remove();ownerPickupMap=null;}
    app.innerHTML=showProfile?profileDialog(authNext):showAuth?loginPage():page('Get By Boat','<p role="status">Loading…</p>');focusAuth();
    route().then(html=>{if(token!==epoch)return;app.innerHTML=html;quote();updateOwnerSkipperFee(document.querySelector('[data-live-form="boat"]'));showOwnerBoatStep(document.querySelector('[data-live-form="boat"]'),1);initOwnerPickupMap();syncCalendarSelection();focusAuth();syncChatSubscription();if(ownerScrollTarget){const target=ownerScrollTarget;ownerScrollTarget='';document.getElementById?.(target)?.scrollIntoView?.({block:'start',behavior:'instant'});}}).catch(e=>{if(token===epoch){app.innerHTML=page('We couldn’t load this page.',`<p role="alert">${errorText(e)}</p>${btn('Try again','refresh')}`);syncChatSubscription()}});return true;
  };
  function updateBookingVerification(form,d){
    const bareboat=d.get('skipper')==='without',expiry=form.dataset.licenceExpiry;
    const blocked=!!session&&bareboat&&(form.dataset.verified!=='true'||!!(expiry&&d.get('end_date')>expiry));
    const warning=form.querySelector('[data-skipper-verification]'),button=form.querySelector('button[type="submit"]');
    if(warning)warning.hidden=!blocked;
    if(button){button.disabled=blocked;button.textContent=blocked?'Verification required':session?'Send booking request':'Log in to request';}
  }
  function quote(){const form=document.querySelector('[data-live-form="request"]');if(!form)return;const d=new FormData(form),n=rentalDayCount(d.get('start_date'),d.get('end_date'));updateBookingVerification(form,d);const out=form.querySelector('[data-quote]');if(!n||n<1){out.textContent='Choose a valid rental period.';return}const charter=n*Number(form.dataset.price),fee=serviceFee(charter),skipperExtra=d.get('skipper')==='with'&&form.dataset.skipperExtra==='true'?n*Number(form.dataset.skipperFee||0):0;out.innerHTML=`<p>${n} ${n===1?'day':'days'} · ${money(guestDailyRate(form.dataset.price))} / day</p><p><strong>Total boat rental: ${money(charter+fee)}</strong></p>${skipperExtra>0?`<p class="fleet-quote-extra">Skipper payable at check-in: <strong>${money(skipperExtra)}</strong> · cash or card, paid directly.</p>`:d.get('skipper')==='with'&&form.dataset.withoutSkipper==='false'?'<p class="fleet-quote-extra">Skipper included in the boat price.</p>':''}`;}
  const verificationFileTypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
  function safeVerificationFile(file){if(!file?.size||file.size>5242880||!verificationFileTypes[file.type])throw Error('Upload each required document as JPEG, PNG, WebP or PDF, no larger than 5 MB.');}
  function syncCalendarSelection(){
    const form=document.querySelector('[data-live-form="block"]');
    const selection=calendarSelection?.boatId===form?.dataset.id?calendarSelection:null;
    const start=selection?[selection.anchor,selection.end].sort()[0]:'';
    const end=selection?[selection.anchor,selection.end].sort()[1]:'';
    if(selection)selection.invalid=start<today()||calendarUnavailable.some(r=>r.start<=end&&r.end>=start);
    for(const day of document.querySelectorAll?.('[data-calendar-date]')||[]){
      const selected=!!selection&&day.dataset.calendarDate>=start&&day.dataset.calendarDate<=end;
      day.classList.toggle('is-selected',selected);
      day.classList.toggle('is-invalid',selected&&selection.invalid);
      day.setAttribute('aria-pressed',String(selected));
    }
    if(!form||!selection)return;
    const first=form.querySelector('[name="start_date"]'),last=form.querySelector('[name="end_date"]');
    if(first)first.value=start;
    if(last)last.value=end;
    const firstDisplay=form.querySelector('[data-euro-date="start_date"]'),lastDisplay=form.querySelector('[data-euro-date="end_date"]');
    if(firstDisplay)firstDisplay.value=euroDate(start);
    if(lastDisplay)lastDisplay.value=euroDate(end);
    const message=form.querySelector('[data-feedback]');
    if(message)message.textContent=selection.invalid?'This range contains reserved, requested or blocked dates. Choose another range.':`Selected ${euroRange(start,end)}. Confirm below to block ${start===end?'this day':'these dates'}.`;
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.disabled=selection.invalid;
  }
  function pickCalendarDay(day,pointer=false){
    const form=document.querySelector('[data-live-form="block"]');
    if(!form||!day?.dataset.calendarDate)return;
    const date=day.dataset.calendarDate,boatId=form.dataset.id;
    if(!calendarSelection||calendarSelection.boatId!==boatId||!calendarSelection.awaitingSecond){
      calendarSelection={boatId,anchor:date,end:date,awaitingSecond:true,dragging:pointer,moved:false,invalid:false};
    }else{
      calendarSelection.end=date;
      calendarSelection.awaitingSecond=false;
      calendarSelection.dragging=pointer;
      calendarSelection.moved=false;
    }
    syncCalendarSelection();
  }
  document.addEventListener('pointerdown',event=>{
    const day=event.target.closest?.('[data-calendar-date]');
    if(!day||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();
    pickCalendarDay(day,true);
  });
  document.addEventListener('pointermove',event=>{
    if(!calendarSelection?.dragging)return;
    const target=document.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-calendar-date]');
    if(!target?.dataset.calendarDate||target.dataset.calendarDate===calendarSelection.end)return;
    calendarSelection.end=target.dataset.calendarDate;
    calendarSelection.moved=true;
    calendarSelection.awaitingSecond=false;
    syncCalendarSelection();
  });
  document.addEventListener('pointerup',()=>{if(calendarSelection){calendarSelection.dragging=false;syncCalendarSelection();}});
  document.addEventListener('pointercancel',()=>{if(calendarSelection)calendarSelection.dragging=false;});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const day=event.target.closest?.('[data-calendar-date]');
    if(day){event.preventDefault();pickCalendarDay(day);}
  });
  document.addEventListener('input',e=>{
    if(e.target.closest('[data-live-form="request"]'))quote();
    const euroName=e.target.dataset?.euroDate;
    if(euroName){
      const form=e.target.closest('[data-live-form="block"]'),hidden=form?.querySelector(`[name="${euroName}"]`);
      if(hidden)hidden.value=parseEuroDate(e.target.value);
      calendarSelection=null;
      for(const day of document.querySelectorAll?.('[data-calendar-date]')||[]){day.classList.remove('is-selected','is-invalid');day.setAttribute('aria-pressed','false');}
      const button=form?.querySelector('button[type="submit"]');
      if(button)button.disabled=false;
    }
    if(e.target.name==='price'){
      const form=e.target.closest('[data-live-form="boat"]'),preview=form?.querySelector('[data-guest-price-preview]');
      if(preview)preview.innerHTML=`Guests see <strong>${money(guestDailyRate(Number(e.target.value)||0))} / day</strong> (your rate + 7% Get By Boat commission).`;
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.closest('[data-live-form="request"]'))quote();
    const boat=e.target.closest('[data-live-form="boat"]');
    if(boat)updateOwnerSkipperFee(boat);
    if(e.target.closest('[data-live-form="block"]')&&e.target.matches?.('[data-euro-date]')){
      calendarSelection=null;
      for(const day of document.querySelectorAll?.('[data-calendar-date]')||[]){day.classList.remove('is-selected','is-invalid');day.setAttribute('aria-pressed','false');}
      const blockForm=e.target.closest('[data-live-form="block"]');
      const submit=blockForm.querySelector('button[type="submit"]');
      if(submit)submit.disabled=false;
      const feedback=blockForm.querySelector('[data-feedback]');
      if(feedback)feedback.textContent='Dates entered manually. Confirm below to block this period.';
    }
    if(boat&&ownerPickupMap?.form===boat){
      if(e.target.name==='country'&&!boat.querySelector('[name="pickup_latitude"]')?.value){
        const country=String(e.target.value||'').trim();
        const center=countryMapCenters[country];
        if(center)ownerPickupMap.map.setView(center.slice(0,2),center[2]);
      }
      if(['pickup_latitude','pickup_longitude'].includes(e.target.name)){
        const latitude=boat.querySelector('[name="pickup_latitude"]'),longitude=boat.querySelector('[name="pickup_longitude"]');
        if(latitude.value!==''&&longitude.value!==''&&validPickupCoordinates(Number(latitude.value),Number(longitude.value))){
          const point=[Number(latitude.value),Number(longitude.value)];
          ownerPickupMap.marker.setLatLng(point);
          ownerPickupMap.map.setView(point,15);
          boat.querySelector('[data-pickup-status]').textContent='Exact pickup pin updated from coordinates. Save the listing to keep this location.';
        }
      }
    }
  });
  document.addEventListener('submit',async e=>{const f=e.target;if(!f.dataset.liveForm)return;e.preventDefault();const button=f.querySelector('button[type="submit"],button:not([type])');if(button?.disabled)return;if(button)button.disabled=true;const feedback=f.querySelector('[data-feedback]');if(feedback)feedback.textContent='Saving…';try{if(!client)throw Error('Connecting your account. Please try again in a moment.');const d=new FormData(f),kind=f.dataset.liveForm;
    if(kind==='search'){location.hash='#/boats?location='+encodeURIComponent(d.get('location'))+'&type='+encodeURIComponent(d.get('type'));return}
    if(kind==='auth'&&!recovery&&authStep==='email'){authEmail=String(d.get('email')||'').trim();authStep='password';render();return}
    if(kind==='auth'){const email=String(d.get('email')||'').trim(),password=String(d.get('password'));if(recovery){check(await client.auth.updateUser({password}));recovery=false;toast('Password updated.');}else if(authMode==='signup'){const result=check(await client.auth.signUp({email,password,options:{emailRedirectTo:authRedirect()}}));if(!result.session){feedback.textContent='Check your inbox to confirm your email. If no email arrives, contact our team through the Contact page.';return}}else check(await client.auth.signInWithPassword({email,password}));await current();location.hash=afterLogin();authStep='email';authEmail='';render();return}
    if(!session){
      if(kind==='request'){
        const start=String(d.get('start_date')||''),end=String(d.get('end_date')||'');
        if(!rentalDayCount(start,end))throw Error('Choose a valid rental period.');
        const query=new URLSearchParams({start,end,guests:String(d.get('guests')||1),skipper:d.get('skipper')==='with'?'with':'without'});
        authNext=safeNext('#/listing/'+f.dataset.id+'?'+query.toString());
      }
      location.hash=loginLink(authNext);return
    }
    if(kind==='details'){
      const details={...(profile.details||{})}, keys=f.dataset.section==='experience'?['boating_level','boat_preference','bio']:['first_name','last_name','birth_date','languages','phone','address','postal_code','city'];
      for(const key of keys)details[key]=String(d.get(key)||'').trim();
      if(f.dataset.section==='experience')details.licences=d.getAll('licences');
      const value={details};if(f.dataset.section==='information'){
        const first=namePart(d.get('first_name')),last=namePart(d.get('last_name'));
        if(!first||!last)throw Error('Please enter your first name and surname.');
        value.display_name=`${first} ${last}`.slice(0,120);
      }
      check(await client.from('profiles').update(value).eq('id',session.user.id).select().single());await current();feedback.textContent='Your profile has been saved.';return;
    }
    if(kind==='verification'){
      if(!hasProfileName(profile))throw Error('Complete your first name and surname before verification.');
      if(!d.get('documents_own'))throw Error('Confirm the documents belong to you.');
      const identityFile=d.get('identity_file'),licenceFile=d.get('licence_file');
      safeVerificationFile(identityFile);safeVerificationFile(licenceFile);
      const identityType=String(d.get('identity_type')||''),licenceType=String(d.get('licence_type')||'');
      const birthDate=String(d.get('birth_date')||''),licenceExpiry=String(d.get('licence_expiry')||'');
      if(!['id_card','passport'].includes(identityType)||!['coastal','offshore','inland','professional','other'].includes(licenceType))throw Error('Choose valid document types.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||birthDate>=today())throw Error('Enter your date of birth as shown on your ID.');
      if(licenceExpiry&&(!/^\d{4}-\d{2}-\d{2}$/.test(licenceExpiry)||licenceExpiry<today()))throw Error('Your boat licence must be valid.');
      const uploaded=[],old=verificationRequest;
      try{
        const upload=async(folder,file)=>{
          const key=`${session.user.id}/${folder}/${crypto.randomUUID()}.${verificationFileTypes[file.type]}`;
          check(await client.storage.from('verification-documents').upload(key,file,{contentType:file.type,upsert:false}));
          uploaded.push(key);return key;
        };
        const identityPath=await upload('identity',identityFile),licencePath=await upload('licence',licenceFile);
        check(await client.from('verification_requests').upsert({user_id:session.user.id,identity_type:identityType,identity_path:identityPath,licence_path:licencePath,licence_type:licenceType,licence_expiry:licenceExpiry||null,birth_date:birthDate,submitted_at:new Date().toISOString()},{onConflict:'user_id'}).select().single());
      }catch(error){if(uploaded.length)await client.storage.from('verification-documents').remove(uploaded);throw error;}
      if(old){const obsolete=[old.identity_path,old.licence_path].filter(Boolean);if(obsolete.length)await client.storage.from('verification-documents').remove(obsolete);}
      await current();render();toast('Your documents are securely submitted. Staff approval is required before booking.');return;
    }
    if(['owner-business','owner-payouts','owner-document','owner-submit'].includes(kind)){
      if(profile?.account_type!=='owner')throw Error('These settings are available only to boat owner accounts.');
      const old=ownerVerificationRequest||{};
      const save=async changes=>{
        if(Object.keys(changes).every(key=>old[key]===changes[key]))return false;
        check(await client.from('owner_verification_requests').upsert({user_id:session.user.id,...changes,application_state:'draft',submitted_at:null},{onConflict:'user_id'}).select().single());
        ownerScrollTarget=kind==='owner-business'?'owner-business-details':kind==='owner-payouts'?'owner-payout-details':'owner-documents';
        await current();render();return true;
      };
      if(kind==='owner-business'){
        let country=String(d.get('business_country')||'').toUpperCase();
        if(country==='OTHER')country=String(d.get('other_business_country')||'').trim().toUpperCase();
        if(!/^[A-Z]{2}$/.test(country))throw Error('Enter a valid two-letter registration country.');
        const legalName=String(d.get('legal_business_name')||'').trim(),tax=String(d.get('tax_identifier')||'').trim();
        const website=String(d.get('business_website')||'').trim(),address=String(d.get('registered_address')||'').trim();
        if(legalName.length<2||legalName.length>180||address.length<6)throw Error('Enter your registered company name and address.');
        if(country==='FR'&&!/^\d{14}$/.test(tax))throw Error('A French SIRET must contain 14 digits.');
        if(country==='HR'&&!/^\d{11}$/.test(tax))throw Error('A Croatian OIB must contain 11 digits.');
        if(tax.length<3||tax.length>80)throw Error('Enter a valid business registration number.');
        if(!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)||website.length>300)throw Error('Enter a business website beginning with https://.');
        const changed=await save({business_country:country,legal_business_name:legalName,tax_identifier:tax,registered_address:address,business_website:website});
        toast(changed?'Business information saved.':'Business information is already up to date.');return;
      }
      if(kind==='owner-payouts'){
        const iban=String(d.get('iban')||'').replace(/\s+/g,'').toUpperCase(),ibanHolder=String(d.get('iban_holder')||'').trim();
        if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban))throw Error('Enter a valid business IBAN.');
        if(ibanHolder.length<2||ibanHolder.length>180)throw Error('Enter the legal name of the business account holder.');
        const changed=await save({iban,iban_holder:ibanHolder});
        toast(changed?'Payout details saved.':'Payout details are already up to date.');return;
      }
      if(kind==='owner-document'){
        const folder=f.dataset.document,fieldName={registration:'registration_path',identity:'identity_path',iban:'iban_proof_path'}[folder];
        if(!fieldName)throw Error('Unknown document type.');
        const file=d.get('document_file');safeVerificationFile(file);
        const identityType=String(d.get('identity_type')||'');
        if(folder==='identity'&&!['id_card','passport'].includes(identityType))throw Error('Choose ID card or passport.');
        const key=`${session.user.id}/${folder}/${crypto.randomUUID()}.${verificationFileTypes[file.type]}`;
        check(await client.storage.from('owner-verification-documents').upload(key,file,{contentType:file.type,upsert:false}));
        try{await save({[fieldName]:key,...(folder==='identity'?{identity_type:identityType}:{})});}
        catch(error){await client.storage.from('owner-verification-documents').remove([key]);throw error;}
        if(old[fieldName])await client.storage.from('owner-verification-documents').remove([old[fieldName]]);
        toast('Document uploaded securely. Other documents were kept.');return;
      }
      if(!hasProfileName(profile))throw Error('Save your legal first name and surname before submitting.');
      if(!d.get('documents_own'))throw Error('Confirm you are authorised to represent the business.');
      if(!ownerComplete(old))throw Error('Complete business information, payout details and all three documents first.');
      if(ownerVerificationState()==='approved'||ownerVerificationState()==='pending')throw Error('This application is already submitted.');
      check(await client.from('owner_verification_requests').upsert({user_id:session.user.id,application_state:'submitted',submitted_at:new Date().toISOString()},{onConflict:'user_id'}).select().single());
      ownerScrollTarget='owner-documents';await current();render();toast('Application submitted. Staff will review your business before you can publish listings.');return;
    }
    if(kind==='review'){
      if(!verificationStaff)throw Error('Staff review access required.');
      const decision=String(d.get('status')||''),note=String(d.get('note')||'').trim();
      if(!['approved','rejected'].includes(decision))throw Error('Choose an approval or rejection.');
      if(decision==='approved'&&(!d.get('identity_matches')||!d.get('licence_matches')))throw Error('Confirm that you checked both documents and matching identity details.');
      if(decision==='rejected'&&!note)throw Error('Explain to the customer what must be corrected.');
      check(await client.from('verification_reviews').upsert({user_id:f.dataset.id,status:decision,note},{onConflict:'user_id'}).select().single());
      const docs=check(await client.from('verification_requests').select('identity_path,licence_path').eq('user_id',f.dataset.id).single());
      const cleanup=await client.storage.from('verification-documents').remove([docs.identity_path,docs.licence_path]);
      await current();render();toast(cleanup.error?'Decision saved. Document cleanup needs staff attention.':'Decision saved. Document copies removed from private storage.');return;
    }
    if(kind==='owner-review'){
      if(!verificationStaff)throw Error('Staff review access required.');
      const decision=String(d.get('status')||''),note=String(d.get('note')||'').trim();
      if(!['approved','rejected'].includes(decision))throw Error('Choose approval or rejection.');
      if(decision==='approved'&&(!d.get('registration_matches')||!d.get('identity_matches')||!d.get('bank_matches')))throw Error('Confirm you checked the registration, identity, website, address and business bank account.');
      if(decision==='rejected'&&!note)throw Error('Explain what the owner needs to correct.');
      check(await client.from('owner_verification_reviews').upsert({user_id:f.dataset.id,status:decision,note},{onConflict:'user_id'}).select().single());
      await current();render();toast('Owner verification decision saved.');return;
    }
    if(kind==='avatar'){
      const file=d.get('photo');if(!file?.size||file.size>5242880||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP under 5 MB.');
      const key=`${session.user.id}/${crypto.randomUUID()}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]}`,old=profile.avatar_path;
      check(await client.storage.from('profile-photos').upload(key,file,{contentType:file.type,upsert:false}));
      try{check(await client.from('profiles').update({avatar_path:key}).eq('id',session.user.id).select().single());}catch(error){await client.storage.from('profile-photos').remove([key]);throw error;}
      if(old)await client.storage.from('profile-photos').remove([old]);await current();render();return;
    }
    if(kind==='password'){const password=String(d.get('password')||'');if(password.length<10)throw Error('Use at least 10 characters.');if(password!==d.get('confirm'))throw Error('The passwords do not match.');check(await client.auth.updateUser({password}));f.reset();feedback.textContent='Password updated.';return;}
    if(kind==='profile'){
      const first=namePart(d.get('first_name')),last=namePart(d.get('last_name'));
      if(!first||!last)throw Error('Please enter your first name and surname.');
      const display_name=`${first} ${last}`.slice(0,120);
      if(f.dataset.accountType&&f.dataset.accountType!==profile?.account_type)throw Error('Account roles cannot be changed. Create a separate account for the other role.');
      check(await client.from('profiles').update({display_name,details:{...(profile?.details||{}),first_name:first,last_name:last}}).eq('id',session.user.id).select().single());
      await current();location.hash=safeNext(f.dataset.next);render();return;
    }
    if(kind==='boat'){
      if(profile?.account_type!=='owner')throw Error('Only boat owner accounts can create listings.');
      if(f.querySelectorAll){
        for(let step=1;step<=3;step++)if(!validateOwnerBoatStep(f,step))throw Error('Complete the required fields before saving your boat.');
      }
      if(d.get('published')==='on'&&ownerVerificationState()!=='approved'&&!f.dataset.id)throw Error('Verify your owner account before publishing a new listing.');
      const withSkipper=d.get('with_skipper')==='on',withoutSkipper=d.get('without_skipper')==='on';
      if(!withSkipper&&!withoutSkipper)throw Error('Offer at least one rental option: with or without skipper.');
      const requestedCountry=String(d.get('country')||'').trim();
      const country=countryLabels.find(name=>name.toLowerCase()===requestedCountry.toLowerCase())||(['United States','United States of America'].includes(requestedCountry)?'USA':'');
      if(!country)throw Error('Choose a country from the 14 available countries.');
      const skipperFee=withSkipper?Number(d.get('skipper_fee_per_day')):0;
      if(!Number.isFinite(skipperFee)||(withSkipper&&skipperFee<=0)||skipperFee<0||skipperFee>10000)throw Error('Enter a skipper price per day greater than €0 (maximum €10,000).');
      const specNames=['engine_hp','length_m','width_m','draft_m','build_year','fuel_lph','speed_knots','crew'];
      const specs={};
      for(const name of specNames){
        const raw=String(d.get('spec_'+name)||'').trim();
        if(!raw)continue;
        const number=Number(raw);
        if(!Number.isFinite(number)||number<0||number>50000)throw Error('Check the technical specification values.');
        specs[name]=number;
      }
      const engineType=String(d.get('spec_engine_type')||'');
      if(!['','outboard','inboard','electric','none','other'].includes(engineType))throw Error('Choose valid technical specification options.');
      if(engineType)specs.engine_type=engineType;
      const insuranceType=String(d.get('insurance_type')||'not_specified');
      if(!['not_specified','none','third_party','comprehensive'].includes(insuranceType))throw Error('Choose a valid insurance type.');
      const deposit=Number(d.get('security_deposit')||0);
      if(!Number.isFinite(deposit)||deposit<0||deposit>100000)throw Error('Enter a refundable security deposit between €0 and €100,000.');
      let imageUrl;const file=d.get('photo');if(file?.size){if(file.size>5242880||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP under 5 MB.');const key=`${session.user.id}/${crypto.randomUUID()}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]}`;check(await client.storage.from('boat-photos').upload(key,file,{contentType:file.type,upsert:false}));imageUrl=client.storage.from('boat-photos').getPublicUrl(key).data.publicUrl;}
      const pickupLocation=String(d.get('pickup_location')||d.get('location')||'').trim();
      if(!pickupLocation||pickupLocation.length>240)throw Error('Enter a pickup address of up to 240 characters.');
      const rawLatitude=String(d.get('pickup_latitude')||'').trim(),rawLongitude=String(d.get('pickup_longitude')||'').trim();
      if(Boolean(rawLatitude)!==Boolean(rawLongitude))throw Error('Set both latitude and longitude, or leave both blank.');
      const pickupLatitude=rawLatitude?Number(rawLatitude):null,pickupLongitude=rawLongitude?Number(rawLongitude):null;
      if(rawLatitude&&!validPickupCoordinates(pickupLatitude,pickupLongitude))throw Error('The pickup pin coordinates are outside the valid map range.');
      const value={owner_id:session.user.id,name:String(d.get('name')).trim(),country,location:String(d.get('location')).trim(),pickup_location:pickupLocation,pickup_latitude:pickupLatitude,pickup_longitude:pickupLongitude,type:d.get('type'),price:Number(d.get('price')),guests:Number(d.get('guests')),description:d.get('description'),published:d.get('published')==='on',with_skipper:withSkipper,without_skipper:withoutSkipper,skipper_fee_per_day:skipperFee,specifications:specs,insurance_type:insuranceType,security_deposit:deposit,...(imageUrl?{photo_url:imageUrl}:{})};
      check(await(f.dataset.id?client.from('boats').update(value).eq('id',f.dataset.id).select().single():client.from('boats').insert(value).select().single()));
      location.hash='#/owner';render();return;
    }
    if(kind==='request'){
      if(profile?.account_type!=='customer')throw Error('Owner accounts cannot rent boats. Use a separate customer account.');
      const mode=d.get('skipper');if(!['with','without'].includes(mode))throw Error('Choose a rental option.');
      if((mode==='with'&&f.dataset.withSkipper==='false')||(mode==='without'&&f.dataset.withoutSkipper==='false'))throw Error('This boat does not offer the selected rental option.');
      if(!hasProfileName(profile)){
        const query=new URLSearchParams({start:String(d.get('start_date')||''),end:String(d.get('end_date')||''),guests:String(d.get('guests')||1),skipper:mode});location.hash=setupLink('#/listing/'+f.dataset.id+'?'+query.toString());return;
      }
      if(mode==='without'&&verificationState()!=='approved'){location.hash='#/account?tab=verification';render();toast('ID and boat driving licence verification is required to rent without a skipper.');return;}
      const start=d.get('start_date'),end=d.get('end_date');if(end<start)throw Error('Last day must be on or after the first day.');
      if(mode==='without'&&verificationRequest?.licence_expiry&&end>verificationRequest.licence_expiry)throw Error('Your boat licence must remain valid through the last rental day.');
      const booking=check(await client.from('bookings').insert({boat_id:f.dataset.id,customer_id:session.user.id,customer_name:profile.display_name,start_date:start,end_date:end,guests:Number(d.get('guests')),with_skipper:mode==='with'}).select().single());
      toast('Request sent to the owner. You can message them now.');location.hash='#/messages?booking='+booking.id;notifyBookingEmail('booking_created',booking.id);return;
    }
    if(kind==='message'){if(!session)throw Error('Please log in to send a message.');const content=String(d.get('content')||'').trim();if(!content||content.length>2000)throw Error('Write a message of up to 2,000 characters.');const message=check(await client.from('booking_messages').insert({booking_id:f.dataset.id,sender_id:session.user.id,content}).select().single());notifyBookingEmail('message',f.dataset.id,message.id);render();toast('Message sent.');return}
    if(kind==='block'){
      if(!rentalDayCount(d.get('start_date'),d.get('end_date')))throw Error('Use valid dates in DD.MM.YYYY format.');
      if(d.get('end_date')<d.get('start_date'))throw Error('Last day must be on or after the first day.');
      if(String(d.get('start_date'))<today())throw Error('Choose a current or future date.');
      if(calendarUnavailable.some(r=>r.start<=d.get('end_date')&&r.end>=d.get('start_date')))throw Error('This range includes unavailable dates. Choose a different period.');
      check(await client.from('boat_blocks').insert({boat_id:f.dataset.id,start_date:d.get('start_date'),end_date:d.get('end_date')}));
      calendarSelection=null;render();
    }
  }catch(err){if(feedback)feedback.textContent=err.message||'Please try again.';else toast(err.message)}finally{if(button)button.disabled=false}},true);
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-live]');if(!b)return;e.preventDefault();if(b.disabled)return;b.disabled=true;try{switch(b.dataset.live){case 'boat-step':{const form=b.closest('[data-live-form="boat"]'),from=Number(form?.dataset.editorStep||1),to=Number(b.dataset.step||1);let valid=true;if(to>from){for(let step=from;step<to;step++)if(!validateOwnerBoatStep(form,step)){valid=false;break;}}if(valid)showOwnerBoatStep(form,to);break;}case 'boat-next':{const form=b.closest('[data-live-form="boat"]'),step=Number(form?.dataset.editorStep||1);if(validateOwnerBoatStep(form,step))showOwnerBoatStep(form,step+1);break;}case 'boat-prev':{const form=b.closest('[data-live-form="boat"]');showOwnerBoatStep(form,Number(form?.dataset.editorStep||1)-1);break;}case 'boat-jump':case 'owner-jump':document.getElementById?.(b.dataset.id)?.scrollIntoView?.({block:'start',behavior:'smooth'});break;case 'favourite':if(profile?.account_type!=='customer')throw Error('Only customer accounts can save rental favourites.');check(await client.from('favourites').upsert({user_id:session.user.id,boat_id:b.dataset.id},{onConflict:'user_id,boat_id',ignoreDuplicates:true}));toast('Saved to favourites.');break;case 'unfavourite':check(await client.from('favourites').delete().eq('user_id',session.user.id).eq('boat_id',b.dataset.id));render();break;case 'auth-close':closeAuth();break;case 'social-google':case 'social-apple':{
      const provider=b.dataset.live==='social-google'?'google':'apple';
      const feedback=document.querySelector('[data-feedback]');
      if(feedback)feedback.textContent='Connecting…';
      try {
        const response=await fetch(AUTH_CONFIG.supabaseUrl+'/auth/v1/settings',{headers:{apikey:AUTH_CONFIG.supabasePublishableKey}});
        if(!response.ok)throw Error('Unable to check sign-in availability. Please try again.');
        const settings=await response.json();
        if(!settings.external?.[provider])throw Error((provider==='google'?'Google':'Apple')+' sign-in is awaiting activation. Please use email for now.');
        check(await client.auth.signInWithOAuth({provider,options:{redirectTo:authRedirect()}}));
      } catch(error) {if(feedback)feedback.textContent=error.message||'Sign-in could not start. Please try again.';else throw error;}
      break;
    }case 'refresh':await current();render();break;case 'auth-mode':authEmail=document.querySelector('[name="email"]')?.value||authEmail;authMode=authMode==='login'?'signup':'login';render();break;case 'logout':case 'logout-owner':{const createOwner=b.dataset.live==='logout-owner';check(await client.auth.signOut());session=null;profile=null;authStep='email';authEmail='';authNext=createOwner?'#/owner':'#/dashboard';ownerIntent=createOwner;window.GBB_ACCOUNT_LINK=null;window.GBB_ACCOUNT_ROLE=null;location.hash=loginLink(authNext);render();break}case 'reset':{const email=document.querySelector('[name="email"]')?.value;if(!email)throw Error('Enter your email address first.');check(await client.auth.resetPasswordForEmail(email,{redirectTo:authRedirect()}));toast('Check your email for the password reset link.');break}case 'accept':case 'decline':case 'cancel':{const action=b.dataset.live;const booking=check(await client.from('bookings').update({status:{accept:'awaiting_payment',decline:'declined',cancel:'cancelled'}[action]}).eq('id',b.dataset.id).select().single());if(action==='accept'||action==='decline')notifyBookingEmail(action==='accept'?'owner_accepted':'owner_declined',booking.id);render();break}case 'unblock':check(await client.from('boat_blocks').delete().eq('id',b.dataset.id).select().single());render();break}}catch(err){toast(err.message||'Please try again.')}finally{b.disabled=false}});
  document.addEventListener('click',event=>{
    const month=event.target.closest?.('[data-calendar-month]');
    if(month&&calendarContext){
      event.preventDefault();
      const {boat,bookings,blocks}=calendarContext,panel=document.querySelector('.fleet-calendar-panel');
      if(!panel)return;
      const selected=month.dataset.calendarMonth;
      panel.innerHTML=calendarMonthContent(boat,bookings,blocks,selected);
      if(typeof history!=='undefined'&&history.replaceState)history.replaceState(null,'',`${location.pathname}${location.search}#/owner?view=calendar&boat=${encodeURIComponent(boat.id)}&month=${selected}`);
      syncCalendarSelection();
      return;
    }
    const both=event.target.closest?.('[data-rental-both]');
    if(both){
      event.preventDefault();
      const form=both.closest('[data-live-form="boat"]');
      if(!form)return;
      const withSkipper=form.querySelector('[name="with_skipper"]'),withoutSkipper=form.querySelector('[name="without_skipper"]');
      if(withSkipper)withSkipper.checked=true;
      if(withoutSkipper)withoutSkipper.checked=true;
      updateOwnerSkipperFee(form);
      return;
    }
    const pickup=event.target.closest?.('[data-pickup-preview]');
    if(pickup){
      event.preventDefault();
      const form=pickup.closest('[data-live-form="boat"]'),mapState=ownerPickupMap;
      if(!mapState||mapState.form!==form){toast('The interactive map is unavailable. You can enter coordinates manually.');return;}
      const country=String(form.querySelector('[name="country"]')?.value||'').trim(),center=countryMapCenters[country];
      if(!center){toast('Select one of the available countries first.');return;}
      mapState.map.setView(center.slice(0,2),center[2]);
      form.querySelector('[data-pickup-status]').textContent='Map centred on '+country+'. Click your marina or drag the pin to choose its exact position.';
    }
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-live="test-email"]');
    if(!button||button.dataset?.live!=='test-email')return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    if(button.disabled)return;
    button.disabled=true;
    const feedback=button.parentElement?.querySelector?.('[data-email-test-feedback]');
    if(feedback)feedback.textContent='Sending test email…';
    try{
      if(!client||!session?.user?.email)throw Error('Please sign in with a confirmed email account first.');
      const {data,error}=await client.functions.invoke('email-self-test',{body:{}});
      if(error)throw Error('Test unavailable. Check the Resend setup or Supabase Edge Function logs.');
      if(feedback)feedback.textContent=data?.sent?'Resend accepted the test email. Check your inbox and spam folder.':data?.reason||'No test email sent.';
    }catch(error){if(feedback)feedback.textContent=error.message||'Unable to send test email.';}
    finally{button.disabled=false;}
  },true);
  // Static sample boats cannot create real requests or paid confirmations.
  document.addEventListener('submit',e=>{if(['reserve-form','checkout-form'].includes(e.target.id)){e.preventDefault();e.stopImmediatePropagation();modal('Example boat','This is an example listing. Explore the live boat catalogue to send a real booking request.');}},true);
  async function boot(){try{client=await authClient();client.auth.onAuthStateChange((event,s)=>{session=s;if(event==='PASSWORD_RECOVERY'){recovery=true;setTimeout(()=>{location.hash='#/login';render()},0)}if(event==='SIGNED_OUT'){profile=null;setTimeout(()=>render(),0)}});await current();if(new URLSearchParams(location.search).has('auth_callback')){const p=parseRoute().params;authNext=safeNext(p.get('next')||(ownerIntent?'#/owner':'#/dashboard'));history.replaceState(null,'',location.pathname+loginLink(authNext));}render()}catch(e){app.innerHTML=page('Connection unavailable.',`<p>${errorText(e)}</p><button class="btn" onclick="location.reload()">Retry</button>`)}}
  render();
  boot();
})();
