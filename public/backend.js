/* Live marketplace. Authorization and prices are enforced by database policies/triggers. */
(() => {
  const accountLoading='<main role="status" aria-live="polite" style="min-height:100dvh;display:grid;place-items:center;background:#f7fbfc;color:#164453;font-family:inherit"><div style="display:flex;align-items:center;gap:12px;font-size:19px;font-weight:600"><span aria-hidden="true" style="width:19px;height:19px;border:2px solid #b6dce4;border-top-color:#009ab6;border-radius:50%;animation:gbb-loading-spin .85s linear infinite"></span>Get By Boat</div><style>@keyframes gbb-loading-spin{to{transform:rotate(360deg)}}</style></main>';
  let authReady=false;
  let client, session, profile, epoch=0, recovery=false, authStep='email', authEmail='', authBackground=null, returnRoute='#/', ownerIntent=new URLSearchParams(location.search).get('owner')==='1';
  let authNext='#/dashboard', avatarUrl='',verificationRequest=null,verificationReview=null,verificationStaff=false,superAdmin=false;
  let ownerVerificationRequest=null,ownerVerificationReview=null,ownerScrollTarget='';
  let chatChannel=null,chatBookingId='';
  let calendarSelection=null,calendarUnavailable=[],calendarContext=null,ownerPickupMap=null,publicPickupMap=null,listingCalendarContext=null,listingCalendarSelection=null;
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
  const passwordChangeField=(label,name)=>`<label class="password-change-field">${esc(label)}<span class="password-change-control"><input name="${name}" type="password" required minlength="10" autocomplete="off" autocapitalize="off" spellcheck="false" data-password-input><button type="button" class="password-visibility-toggle" data-password-visibility aria-label="Show ${esc(label.toLowerCase())}" aria-pressed="false"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label>`;
  const profileBirthField=(value='',label='Date of birth (optional)',name='birth_date')=>`<label>${esc(label)}<input class="profile-birth-input" name="${name}" type="date" value="${esc(value)}" tabindex="-1"><button type="button" class="profile-birth-trigger" data-profile-birth-open="${name}" aria-label="Choose ${esc(label)}">${value?esc(value.split('-').reverse().join('/')):'dd/mm/yyyy'} ${icon('calendar')}</button></label>`;
  const profileLanguageOptions=['Albanian','Arabic','Armenian','Azerbaijani','Belarusian','Bosnian','Bulgarian','Catalan','Chinese','Corsican','Croatian','Czech','Danish','Dutch','English','Estonian','Faroese','Finnish','French','Georgian','German','Greek','Hungarian','Icelandic','Italian','Japanese','Korean','Latvian','Lithuanian','Luxembourgish','Macedonian','Maltese','Montenegrin','Norwegian','Polish','Portuguese','Romanian','Russian','Serbian','Slovak','Slovenian','Spanish','Swedish','Turkish','Ukrainian'];
  const profileLanguageSuggestions=()=>`<datalist id="profile-language-suggestions">${profileLanguageOptions.map(language=>`<option value="${esc(language)}"></option>`).join('')}</datalist>`;
  const profileLanguagesField=value=>{
    const selected=String(value||'').split(/[,;]+/).map(v=>v.trim()).filter(Boolean);
    const summary=selected.length?selected.slice(0,4).join(', ')+(selected.length>4?' +'+(selected.length-4):''):'Choose your languages';
    return `<label class="profile-language-label">Languages spoken
      <div class="language-selector" data-profile-language-picker>
        <button type="button" class="language-selector-trigger" data-language-toggle aria-expanded="false">
          <span class="language-selector-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.6 2.5 4 5.5 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.5-4-9s1.4-6.5 4-9z"></path></svg></span><span class="language-selector-summary" data-language-summary>${esc(summary)}</span>
          
          <span class="language-selector-caret" aria-hidden="true">⌄</span>
        </button>
        <div class="language-selector-popover" data-language-popover hidden>
          <div class="language-selector-top"><strong>Choose languages</strong><span data-language-picked>${selected.length} selected</span></div>
          <div class="language-selector-search-wrap"><span aria-hidden="true">⌕</span><input class="profile-language-search" type="text" placeholder="Search languages..." autocomplete="off" aria-label="Search languages"></div>
          <div class="language-selector-options" data-profile-language-suggestions></div>
          <div class="language-selector-footer"><button type="button" data-language-clear>Clear all</button><button type="button" data-language-done>Done</button></div>
        </div>
        <input type="hidden" name="languages" value="${esc(selected.join(', '))}">
      </div>
    </label>`;
  };
  const profilePhoneCodes=`Afghanistan:+93|Albania:+355|Algeria:+213|Andorra:+376|Angola:+244|Antigua and Barbuda:+1268|Argentina:+54|Armenia:+374|Australia:+61|Austria:+43|Azerbaijan:+994|Bahamas:+1242|Bahrain:+973|Bangladesh:+880|Barbados:+1246|Belarus:+375|Belgium:+32|Belize:+501|Benin:+229|Bhutan:+975|Bolivia:+591|Bosnia and Herzegovina:+387|Botswana:+267|Brazil:+55|Brunei:+673|Bulgaria:+359|Burkina Faso:+226|Burundi:+257|Cambodia:+855|Cameroon:+237|Canada:+1|Cape Verde:+238|Central African Republic:+236|Chad:+235|Chile:+56|China:+86|Colombia:+57|Comoros:+269|Congo:+242|Costa Rica:+506|Croatia:+385|Cuba:+53|Cyprus:+357|Czechia:+420|Denmark:+45|Djibouti:+253|Dominica:+1767|Dominican Republic:+1809|Ecuador:+593|Egypt:+20|El Salvador:+503|Estonia:+372|Eswatini:+268|Ethiopia:+251|Fiji:+679|Finland:+358|France:+33|Gabon:+241|Gambia:+220|Georgia:+995|Germany:+49|Ghana:+233|Greece:+30|Grenada:+1473|Guatemala:+502|Guinea:+224|Guinea-Bissau:+245|Guyana:+592|Haiti:+509|Honduras:+504|Hungary:+36|Iceland:+354|India:+91|Indonesia:+62|Iran:+98|Iraq:+964|Ireland:+353|Israel:+972|Italy:+39|Ivory Coast:+225|Jamaica:+1876|Japan:+81|Jordan:+962|Kazakhstan:+7|Kenya:+254|Kiribati:+686|Kosovo:+383|Kuwait:+965|Kyrgyzstan:+996|Laos:+856|Latvia:+371|Lebanon:+961|Lesotho:+266|Liberia:+231|Libya:+218|Liechtenstein:+423|Lithuania:+370|Luxembourg:+352|Madagascar:+261|Malawi:+265|Malaysia:+60|Maldives:+960|Mali:+223|Malta:+356|Marshall Islands:+692|Mauritania:+222|Mauritius:+230|Mexico:+52|Micronesia:+691|Moldova:+373|Monaco:+377|Mongolia:+976|Montenegro:+382|Morocco:+212|Mozambique:+258|Myanmar:+95|Namibia:+264|Nauru:+674|Nepal:+977|Netherlands:+31|New Zealand:+64|Nicaragua:+505|Niger:+227|Nigeria:+234|North Korea:+850|North Macedonia:+389|Norway:+47|Oman:+968|Pakistan:+92|Palau:+680|Panama:+507|Papua New Guinea:+675|Paraguay:+595|Peru:+51|Philippines:+63|Poland:+48|Portugal:+351|Qatar:+974|Romania:+40|Russia:+7|Rwanda:+250|Samoa:+685|San Marino:+378|Sao Tome and Principe:+239|Saudi Arabia:+966|Senegal:+221|Serbia:+381|Seychelles:+248|Sierra Leone:+232|Singapore:+65|Slovakia:+421|Slovenia:+386|Solomon Islands:+677|Somalia:+252|South Africa:+27|South Korea:+82|South Sudan:+211|Spain:+34|Sri Lanka:+94|St Kitts and Nevis:+1869|St Lucia:+1758|St Vincent and the Grenadines:+1784|Sudan:+249|Suriname:+597|Sweden:+46|Switzerland:+41|Syria:+963|Taiwan:+886|Tajikistan:+992|Tanzania:+255|Thailand:+66|Timor-Leste:+670|Togo:+228|Tonga:+676|Trinidad and Tobago:+1868|Tunisia:+216|Turkey:+90|Turkmenistan:+993|Tuvalu:+688|Uganda:+256|Ukraine:+380|United Arab Emirates:+971|United Kingdom:+44|United States:+1|Uruguay:+598|Uzbekistan:+998|Vanuatu:+678|Vatican City:+39|Venezuela:+58|Vietnam:+84|Yemen:+967|Zambia:+260|Zimbabwe:+263`.split('|').map(entry=>entry.split(':'));
  const profilePhoneParts=value=>{
    const stored=String(value||'').trim();
    const code=[...new Set(profilePhoneCodes.map(([,dial])=>dial))].sort((a,b)=>b.length-a.length).find(dial=>stored.startsWith(dial))||'';
    return {code,local:code?stored.slice(code.length).trim():stored};
  };
  const profilePhoneField=value=>{
    const {code,local}=profilePhoneParts(value);
    const selected=profilePhoneCodes.findIndex(([,dial])=>dial===code);
    return `<label class="profile-phone-field">Telephone<span class="profile-phone-inputs"><select name="phone_code" aria-label="Telephone country code"><option value="">Country code</option>${profilePhoneCodes.map(([country,dial],i)=>`<option value="${esc(dial)}" ${i===selected?'selected':''}>${esc(country)} (${esc(dial)})</option>`).join('')}</select><input name="phone_local" type="tel" value="${esc(local)}" maxlength="36" autocomplete="tel-national" inputmode="tel" placeholder="Phone number" aria-label="Telephone number"></span></label>`;
  };
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
      && Object.keys(request).every(key=>key==='application_state'||JSON.stringify(request[key])===JSON.stringify(review.reviewed_request[key])||(key==='payout_bank_details'&&request[key]==null&&!Object.prototype.hasOwnProperty.call(review.reviewed_request,key)));
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
    if(session&&path==='/messages'){
      const owner=profile?.account_type==='owner',initial=esc((profile?.display_name||'G').slice(0,1).toUpperCase());
      return `<header class="member-header message-app-header"><a class="member-brand" href="#/">${waveLogo()}<span>Get By Boat</span></a><nav aria-label="Main navigation"><a href="#/${owner?'owner':'bookings'}">${owner?'My boats':'My bookings'}</a><a href="#/messages" aria-current="page">Messages</a><a href="#/account">My account</a><a class="member-mini-avatar" href="#/account" aria-label="My profile">${avatarUrl?`<img src="${esc(avatarUrl)}" alt="">`:initial}</a></nav></header><main class="message-workspace">${body}</main>`;
    }
    if(session&&['/dashboard','/bookings','/owner','/account','/favourites','/staff','/reservations','/messages'].includes(path)){
      const isOwner=profile?.account_type==='owner';
      const links=superAdmin?[['/dashboard','Overview','dashboard'],['/account','My profile','user'],['/reservations','Reservations','calendar'],['/staff','Staff verification','shield']]:verificationStaff?[['/dashboard','Overview','dashboard'],['/account','My profile','user'],['/staff','Staff verification','shield']]:[['/dashboard','Overview','dashboard'],['/account','My profile','user'],...(isOwner?[['/owner','My boats','ship'],['/owner?view=requests','Booking requests','mail']]:[['/bookings','My bookings','calendar'],['/favourites','Saved boats','heart']]),['/messages','Messages','message']];
      const memberName=esc(profile?.display_name||'Traveller');
      const initials=esc((profile?.display_name||'G').slice(0,1).toUpperCase());
      return `<header class="member-header"><a class="member-brand" href="#/">${waveLogo()}<span>Get By Boat</span></a><nav aria-label="Top navigation"><span class="member-locale">EN · EUR</span>${isOwner?`<a class="member-host-link" href="#/owner">${icon('plus')} My boats</a>`:''}<a class="member-mini-avatar" href="#/account" aria-label="My profile">${avatarUrl?`<img src="${esc(avatarUrl)}" alt="">`:initials}</a></nav></header><main class="member-shell"><aside class="member-sidebar"><div class="member-side-label">MY ACCOUNT</div><a href="#/account" class="member-identity">${avatarUrl?`<img class="member-avatar" src="${esc(avatarUrl)}" alt="Your profile photo">`:`<div class="member-avatar member-avatar-empty" aria-hidden="true">${initials}</div>`}<span><strong>${memberName}</strong><small>${superAdmin?'Super Admin':verificationStaff?'Staff account':isOwner?'Boat owner':'Traveller account'}</small></span>${icon('chevron')}</a><nav aria-label="Account navigation">${links.map(([href,label,symbol])=>`<a href="#${href}" ${path===href.split('?')[0]&&(href.includes('?')?params.get('view')==='requests':!params.get('view'))?'aria-current="page"':''} ${label==='Booking requests'?'data-sidebar-notification="requests"':label==='Messages'?'data-sidebar-notification="messages"':''}>${icon(symbol)}<span>${label}</span>${label==='Booking requests'?sidebarBadge(sidebarNotifications.requests):label==='Messages'?sidebarBadge(sidebarNotifications.messages):''}</a>`).join('')}</nav><div class="member-side-bottom"><a href="#/contact">${icon('headset')} Help & support</a><button type="button" data-live="logout">${icon('arrow')} Log out</button></div></aside><section class="member-main">${path==='/dashboard'||(path==='/owner'&&params.has('edit'))?'':`<div class="member-page-kicker">YOUR GET BY BOAT ACCOUNT</div><h1>${title}</h1>`}${body}</section></main>`;
    }
    if(path.startsWith('/listing/'))return `${header('boats')}<main class="shell live-page live-listing-page"><a class="listing-back" href="#/boats">← All boats</a><h1>${title}</h1>${body}</main>${footer()}`;
    if(path==='/boats')return `${header('boats')}<main class="shell live-page live-discovery-page"><h1>${title}</h1>${body}</main>${footer()}`;
    return `${header()}<main class="shell live-page">${nav()}<h1>${title}</h1>${body}</main>${footer()}`;
  };
  const sidebarNotifications={requests:0,messages:0};
  const sidebarBadge=count=>count>0?`<span class="member-nav-count" aria-label="${count} unread">${count>99?'99+':count}</span>`:'';
  const updateSidebarNotificationBadges=()=>{
    document.querySelectorAll('[data-sidebar-notification]').forEach(link=>{
      const count=sidebarNotifications[link.dataset.sidebarNotification]||0;
      link.querySelector('.member-nav-count')?.remove();
      if(count)link.insertAdjacentHTML('beforeend',sidebarBadge(count));
    });
  };
  async function refreshSidebarNotifications(){
    if(!client||!session?.user||!profile||superAdmin||verificationStaff)return;
    const owner=profile.account_type==='owner';
    const requests=owner?client.from('bookings').select('id',{count:'exact',head:true}).eq('status','pending_owner'):Promise.resolve({count:0,error:null});
    const messages=client.from('booking_messages').select('id',{count:'exact',head:true}).neq('sender_id',session.user.id).is('read_at',null);
    const [a,b]=await Promise.all([requests,messages]);
    if(a.error||b.error)throw a.error||b.error;
    sidebarNotifications.requests=a.count||0;
    sidebarNotifications.messages=b.count||0;
    updateSidebarNotificationBadges();
  }
  const errorText=e=>esc(e?.message||'Something went wrong. Please try again.');
  const status=s=>({pending_owner:'Waiting for owner',awaiting_payment:'Accepted · payment not connected',confirmed:'Confirmed',cancelled:'Cancelled',declined:'Declined'}[s]||s);
  const check=({data,error})=>{if(error)throw error;return data};
  const dateFields=()=>field('First day','start_date','date',state.start||today(),`required min="${today()}"`)+field('Last day','end_date','date',state.end||state.start||today(),`required min="${today()}"`);
  function bookingDateFields(){
 const start=state.start||today(),end=state.end||start;
 return '<div class="booking-date-range"><span class="booking-date-heading">Dates</span><button type="button" class="booking-date-trigger" data-booking-date-open aria-label="Choose check-in and check-out dates"><span><small>Check-in</small><strong data-booking-start-label>'+euroDate(start)+'</strong></span><span class="booking-date-arrow">›</span><span><small>Check-out</small><strong data-booking-end-label>'+euroDate(end)+'</strong></span></button><input type="hidden" name="start_date" value="'+start+'"><input type="hidden" name="end_date" value="'+end+'"></div>';
}
  let bookingDateDraft=null,bookingDateMonth=null;
  function bookingCalendarDialog(){
 const form=document.querySelector('[data-live-form="request"]');if(!form)return;
 const unavailable=JSON.parse(form.dataset.unavailable||'[]'),month=bookingDateMonth||today().slice(0,7);
 const dateMonth=m=>{
  const [year,number]=m.split('-').map(Number),first=new Date(Date.UTC(year,number-1,1)),length=new Date(Date.UTC(year,number,0)).getUTCDate(),padding=(first.getUTCDay()+6)%7;
  const title=first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
  const cells=Array.from({length:padding},()=>'<span></span>');
  for(let day=1;day<=length;day++){
   const iso=m+'-'+String(day).padStart(2,'0'),busy=unavailable.some(r=>r.start_date<=iso&&r.end_date>=iso),past=iso<today();
   if(busy||past){cells.push('<span class="booking-calendar-day is-disabled" title="'+(busy?'Unavailable':'Past date')+'">'+day+'</span>');continue;}
   const start=bookingDateDraft?.start,end=bookingDateDraft?.end,selected=iso===start||iso===end,between=!!start&&!!end&&iso>start&&iso<end;
   cells.push('<button type="button" class="booking-calendar-day '+(selected?'is-picked ':between?'is-between ':'')+'" data-booking-day="'+iso+'" aria-pressed="'+selected+'">'+day+'</button>');
  }
  return '<div class="booking-calendar-month"><h3>'+title+'</h3><div class="booking-calendar-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="booking-calendar-days">'+cells.join('')+'</div></div>';
 };
 let dialog=document.querySelector('[data-booking-calendar-dialog]');
 if(!dialog){dialog=document.createElement('div');dialog.className='booking-calendar-overlay';dialog.dataset.bookingCalendarDialog='';document.body.appendChild(dialog);}
 dialog.innerHTML='<div class="booking-calendar-panel" role="dialog" aria-modal="true" aria-label="Choose rental dates"><div class="booking-calendar-toolbar"><button type="button" data-booking-month="-1" aria-label="Previous month">‹</button><span>Choose your rental dates</span><button type="button" data-booking-month="1" aria-label="Next month">›</button></div><div class="booking-calendar-months">'+dateMonth(month)+dateMonth(shiftMonth(month,1))+'</div><p class="booking-calendar-status" data-booking-calendar-status>Select the first day, then the last day.</p><div class="booking-calendar-footer"><button type="button" class="booking-calendar-clear" data-booking-date-clear>Clear dates</button><div><button type="button" class="booking-calendar-cancel" data-booking-date-close>Cancel</button><button type="button" class="btn booking-calendar-save" data-booking-date-save '+(!bookingDateDraft?.end?'disabled':'')+'>Save</button></div></div></div>';
 if(bookingDateDraft?.start&&bookingDateDraft?.end)dialog.querySelector('[data-booking-calendar-status]').textContent=euroDate(bookingDateDraft.start)+' – '+euroDate(bookingDateDraft.end);
}
  function closeBookingCalendar(){document.querySelector('[data-booking-calendar-dialog]')?.remove();bookingDateDraft=null;}
  const calendarDateFields=()=>{
    const first=state.start||today(),last=state.end||first;
    return `<div class="fleet-euro-dates"><label>First day (DD.MM.YYYY)<input type="text" inputmode="numeric" data-euro-date="start_date" value="${euroDate(first)}" placeholder="DD.MM.YYYY" autocomplete="off"><input type="hidden" name="start_date" value="${first}"></label><label>Last day (DD.MM.YYYY)<input type="text" inputmode="numeric" data-euro-date="end_date" value="${euroDate(last)}" placeholder="DD.MM.YYYY" autocomplete="off"><input type="hidden" name="end_date" value="${last}"></label></div>`;
  };
  const photo=url=>{try{const u=new URL(url);return u.origin===AUTH_CONFIG.supabaseUrl&&u.pathname.startsWith('/storage/v1/object/public/boat-photos/')?u.href:''}catch{return ''}};
  const picture=b=>photo(b.photo_url)?`<img class="live-photo" src="${esc(photo(b.photo_url))}" alt="${esc(b.name)}" loading="lazy">`:'<div class="live-placeholder">A day at sea awaits</div>';
  let galleryLightbox=null;
  function closeBoatGallery(){if(galleryLightbox){galleryLightbox.overlay.remove();galleryLightbox=null;document.body.style.overflow='';}}
  function openBoatGallery(urls,index=0){
    closeBoatGallery();
    if(!urls.length)return;
    const overlay=document.createElement('div');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Boat photos');
    overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(5,20,28,.96);display:flex;align-items:center;justify-content:center;padding:55px 60px;color:#fff';
    overlay.innerHTML='<button type="button" data-lightbox-close aria-label="Close gallery" style="position:absolute;top:18px;right:20px;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid #ffffff55;border-radius:50%;background:#263b49dd;color:#fff;cursor:pointer;z-index:3"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg></button><button type="button" data-lightbox-step="-1" aria-label="Previous photo" style="position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;border:1px solid #ffffff55;background:#263b49dd;color:#fff;border-radius:50%;padding:0;width:48px;height:48px;cursor:pointer;z-index:2;box-shadow:0 2px 14px #0005;left:18px"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><img data-lightbox-image alt="Boat photo" style="max-width:100%;max-height:85vh;object-fit:contain;border-radius:8px"><button type="button" data-lightbox-step="1" aria-label="Next photo" style="position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;border:1px solid #ffffff55;background:#263b49dd;color:#fff;border-radius:50%;padding:0;width:48px;height:48px;cursor:pointer;z-index:2;box-shadow:0 2px 14px #0005;right:18px"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button><span data-lightbox-count style="position:absolute;bottom:16px;font-size:15px"></span>';
    const change=step=>{index=(index+step+urls.length)%urls.length;overlay.querySelector('[data-lightbox-image]').src=urls[index];overlay.querySelector('[data-lightbox-count]').textContent=(index+1)+' / '+urls.length;};
    overlay.querySelector('[data-lightbox-close]').addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();closeBoatGallery();},true);
    overlay.querySelectorAll('[data-lightbox-step]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();change(Number(button.dataset.lightboxStep));},true));
    overlay.addEventListener('click',event=>{if(event.target===overlay){event.preventDefault();closeBoatGallery();}});
    let startX=null;
    overlay.addEventListener('touchstart',event=>{startX=event.touches[0]?.clientX??null;},{passive:true});
    overlay.addEventListener('touchend',event=>{if(startX===null)return;const delta=(event.changedTouches[0]?.clientX??startX)-startX;if(Math.abs(delta)>45)change(delta<0?1:-1);startX=null;},{passive:true});
    document.body.appendChild(overlay);document.body.style.overflow='hidden';galleryLightbox={overlay,change};change(0);overlay.querySelector('[data-lightbox-close]').focus();
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-gallery-open],[data-gallery-step],[data-gallery-select]');if(!trigger)return;
    const gallery=trigger.closest('[data-boat-gallery]');if(!gallery)return;
    event.preventDefault();
    let urls=[];try{urls=JSON.parse(gallery.dataset.images||'[]').filter(photo);}catch{}
    if(!urls.length)return;
    if(trigger.hasAttribute('data-gallery-open')){openBoatGallery(urls,Number(trigger.dataset.galleryOpen)||0);return;}
    const main=gallery.querySelector('[data-gallery-main]'),counter=gallery.querySelector('[data-gallery-count]');
    const current=Number(gallery.dataset.index||0),next=trigger.hasAttribute('data-gallery-select')?Math.max(0,Math.min(urls.length-1,Number(trigger.dataset.gallerySelect)||0)):(current+Number(trigger.dataset.galleryStep)+urls.length)%urls.length;
    gallery.dataset.index=String(next);if(main){main.src=urls[next];main.alt='Boat photo '+(next+1);}
    if(counter)counter.textContent=(next+1)+' / '+urls.length;
    gallery.querySelectorAll('[data-gallery-select]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.gallerySelect)===next)));
    const mainButton=gallery.querySelector('[data-gallery-main]')?.closest('button');if(mainButton)mainButton.dataset.galleryOpen=String(next);
  });
  document.addEventListener('keydown',event=>{if(!galleryLightbox)return;if(event.key==='Escape')closeBoatGallery();else if(event.key==='ArrowRight'){event.preventDefault();galleryLightbox.change(1);}else if(event.key==='ArrowLeft'){event.preventDefault();galleryLightbox.change(-1);}});
  const socialButton=(provider,label)=>`<button type="button" class="auth-provider" data-live="social-${provider}"><span aria-hidden="true" class="auth-provider-icon">${provider==='google'?'<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3-4.5 3-7.7z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.8-2.5l-3.4-2.6c-.9.6-2 .9-3.4.9-2.7 0-5-1.8-5.8-4.2H2.7v2.7A10.3 10.3 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.2V7.7H2.7a10 10 0 0 0 0 8.6z"/><path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.8 1.5L18.7 5A9.6 9.6 0 0 0 12 2a10.3 10.3 0 0 0-9.3 5.7l3.5 2.7C7 8 9.3 6.2 12 6.2z"/></svg>':'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.1 12.7c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.7 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .6 1 1.4 2 2.4 1.9 1-.1 1.3-.7 2.6-.7s1.6.7 2.7.7 1.7-1 2.4-1.9c.7-1.1 1-2.1 1-2.2-.1 0-1.9-.7-1.9-3.1zM15.1 6.7c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.8-1 2.8 1 .1 2-.5 2.7-1.2z"/></svg>'}</span>${label}</button>`;
  const loginPage=()=>`<div class="auth-background" inert aria-hidden="true">${authBackground||home()}</div><div class="auth-scrim" data-auth-backdrop><section class="auth-dialog ${!recovery&&authMode==='signup'?'auth-dialog-signup':''}" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" tabindex="-1"><div class="auth-dialog-head"><button type="button" class="auth-close" data-live="auth-close" aria-label="Close login">×</button><span>${recovery?'Reset password':`${ownerIntent?'Boat owner':'Customer'} · ${authMode==='signup'?'Create account':'Log in'}`}</span></div><div class="auth-dialog-body">${!recovery&&authMode==='signup'?'<span class="auth-mode-badge">NEW ACCOUNT</span>':''}<h2 id="auth-dialog-title">${recovery?'Set a new password':authMode==='signup'?'Create your account':ownerIntent?'Welcome aboard, captain':'Welcome to Get By Boat'}</h2>${!recovery?`<p class="auth-owner-copy">${authMode==='signup'?'Register with your email address and create a password to join Get By Boat.':ownerIntent?'List your boat, manage your calendar and respond to booking requests.':authNext.startsWith('#/listing/')?'Log in to continue your booking request. Your boat and dates are saved.':'Find your next day at sea and manage your booking requests.'}</p>`:''}<form data-live-form="auth" class="live-form auth-form">${!recovery?field('Email','email','email',authEmail,'required autocomplete="email" placeholder="Email"'):''}${recovery||authMode==='signup'||authStep==='password'?field('Password','password','password','','required minlength="'+(recovery||authMode==='signup'?'10':'1')+'" autocomplete="'+(recovery||authMode==='signup'?'off':'current-password')+'"'):''}<button class="btn auth-primary" type="submit">${recovery?'Save password':authMode==='signup'?'Create account':authStep==='email'?'Continue':'Log in'}</button><p role="status" data-feedback></p>${!recovery?`<div class="live-auth-divider">OR</div><div class="live-social">${socialButton('google','Continue with Google')}${socialButton('apple','Continue with Apple')}</div><div class="auth-switch"><button type="button" data-live="auth-mode">${authMode==='signup'?'Already have an account? Log in':'New to Get By Boat? Create an account'}</button>${authStep==='password'?'<button type="button" data-live="reset">Forgot password?</button>':''}</div>`:''}</form></div></section></div>`;
  const authRedirect=()=>location.origin+location.pathname+'?auth_callback=1'+loginLink(authNext);
  function closeAuth(){authStep='email';authEmail='';authBackground=null;ownerIntent=false;authNext='#/dashboard';returnRoute='#/';document.body?.classList.remove('auth-open');if(location.hash!=='#/')location.hash='#/';else render();setTimeout(()=>document.querySelector('a[href="#/login"]')?.focus(),0)}
  function focusAuth(){const dialog=document.querySelector('.auth-dialog');document.body?.classList.toggle('auth-open',!!dialog);if(dialog)(dialog.querySelector('input[name="display_name"]')||dialog.querySelector(authStep==='password'?'input[name="password"]':'input'))?.focus();}
  document.addEventListener('keydown',event=>{const dialog=document.querySelector('.auth-dialog');if(!dialog)return;if(event.key==='Escape'){event.preventDefault();closeAuth();return}if(event.key==='Tab'){const items=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],select,textarea')];const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}});
  document.addEventListener('click',event=>{if(event.target.matches?.('[data-auth-backdrop]'))closeAuth()});
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-verification-email]');
    if(!button)return;
    event.preventDefault();
    if(button.disabled)return;
    const feedback=button.parentElement?.querySelector('.verification-email-feedback');
    button.disabled=true;
    if(feedback)feedback.textContent='Sending…';
    try{
      const {data,error}=await client.functions.invoke('verification-approved-email',{body:{user_id:button.dataset.verificationEmail}});
      if(error||!data?.sent)throw error||new Error(data?.error||'Email not sent');
      if(feedback)feedback.textContent=data.already_sent?'Email already sent.':'Verification email sent.';
    }catch(error){
      if(feedback)feedback.textContent='Could not send email. Please try again.';
    }finally{button.disabled=false;}
  });

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-password-visibility]');
    if(!button)return;
    const input=button.closest('.password-change-control')?.querySelector('[data-password-input]');
    if(!input)return;
    const show=input.type==='password';
    input.type=show?'text':'password';
    button.setAttribute('aria-pressed',String(show));
    button.setAttribute('aria-label',(show?'Hide ':'Show ')+(input.name==='confirm'?'confirmation password':'new password'));
    input.focus({preventScroll:true});
  });

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
    verificationRequest=null;verificationReview=null;ownerVerificationRequest=null;ownerVerificationReview=null;verificationStaff=false;superAdmin=false;
    // Independent account checks run together to avoid serial network round trips on refresh.
    avatarUrl='';
    if(session){
      const userId=session.user.id;
      const owner=profile?.account_type==='owner';
      const requests=[
        client.rpc('is_verification_staff'),
        client.rpc('is_super_admin'),
        client.from('verification_requests').select('*').eq('user_id',userId).maybeSingle(),
        client.from('verification_reviews').select('*').eq('user_id',userId).maybeSingle(),
        ...(owner?[
          client.from('owner_verification_requests').select('*').eq('user_id',userId).maybeSingle(),
          client.from('owner_verification_reviews').select('*').eq('user_id',userId).maybeSingle()
        ]:[]),
        ...(profile?.avatar_path?[client.storage.from('profile-photos').createSignedUrl(profile.avatar_path,3600)]:[])
      ];
      const results=await Promise.all(requests);
      verificationStaff=!!check(results[0]);
      superAdmin=!!check(results[1]);
      verificationRequest=check(results[2]);
      verificationReview=check(results[3]);
      if(owner){
        ownerVerificationRequest=check(results[4]);
        ownerVerificationReview=check(results[5]);
      }
      if(profile?.avatar_path){
        const avatarResult=results[owner?6:4];
        if(!avatarResult.error)avatarUrl=avatarResult.data.signedUrl;
      }
    }
  }
  const requireAccount=()=>!session?loginPage():!hasProfileName(profile)?profileDialog(authNext):null;
  function verificationForm(){
    const v=verificationRequest||{},s=verificationState();
    return `<div class="profile-panel verification-intro"><div class="verification-heading"><div><span class="member-page-kicker">IDENTITY & BOATING SAFETY</span><h2>Verify your identity and boat licence</h2><p>Verification is optional for your account and for rentals with a skipper. To rent without a skipper, upload both your ID/passport and boating licence and wait for staff approval.</p></div><span class="verification-badge ${esc(s)}">${esc(verificationLabel(s))}</span></div><div class="verification-steps"><span>${icon('user')} Your legal name</span><span>${icon('shield')} ID / passport</span><span>${icon('ship')} Boat licence</span><span>${icon('check')} Staff review</span></div>${s==='rejected'&&verificationReview?.note?`<p class="verification-warning">Reviewer note: ${esc(verificationReview.note)}</p>`:''}${s==='approved'?'<p class="verification-good">Your identity and boating licence have been approved. You can request a rental without a skipper while your licence remains valid. Uploading replacement documents starts a new review.</p>':''}${s==='pending'?'<p class="member-note">Your documents have been submitted. A Get By Boat staff member will review the information. Until approved, you can still rent a boat with a skipper.</p>':''}</div>
    <form class="profile-panel live-form verification-upload" data-live-form="verification" enctype="multipart/form-data"><h2>${v.user_id?'Update verification documents':'Submit documents for verification'}</h2><p class="member-note">The name on your ID/passport and boat licence must match your customer profile: <strong>${esc(profile.display_name)}</strong>. If it does not, correct your profile before uploading.</p><div class="live-columns"><label>Identity document type<select name="identity_type" required><option value="id_card" ${v.identity_type==='id_card'?'selected':''}>National ID card</option><option value="passport" ${v.identity_type==='passport'?'selected':''}>Passport</option></select></label>${profileBirthField(v.birth_date||profile.details?.birth_date||'','Date of birth (as shown on ID)')}</div><div class="live-columns"><label>ID card / passport image or PDF<input type="file" name="identity_file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><label>Boat driving licence image or PDF<input type="file" name="licence_file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label></div><div class="live-columns"><label>Boat licence category<select name="licence_type" required>${[['coastal','Coastal'],['offshore','Offshore'],['inland','Inland'],['professional','Professional skipper'],['other','Other recognised licence']].map(([value,label])=>`<option value="${value}" ${v.licence_type===value?'selected':''}>${label}</option>`).join('')}</select></label>${profileBirthField(v.licence_expiry||'','Licence expiration (leave blank if permanent)','licence_expiry')}</div><label class="live-check"><input type="checkbox" name="documents_own" required> I confirm both documents are mine, accurate and provided for review to verify my identity and qualification.</label><p class="member-note">Accepted: JPEG, PNG, WebP or PDF, up to 5 MB each. <a href="#/privacy">Privacy information</a></p><button class="btn" type="submit">${s==='approved'?'Submit replacement documents':'Submit for manual review'}</button><p role="status" data-feedback></p></form>`;
  }

  const ownerCountryOptions=[["HR","Croatia"],["GR","Greece"],["ES","Spain"],["FR","France"],["IT","Italy"],["PT","Portugal"],["CY","Cyprus"],["TR","Turkey"],["MT","Malta"],["AU","Australia"],["ME","Montenegro"],["AL","Albania"],["US","United States"],["BS","Bahamas"]];
  const ownerTaxIdDetails={"HR":{"label":"OIB","hint":"Enter the 11-digit OIB of the registered Croatian business."},"GR":{"label":"AFM (Tax identification number)","hint":"Enter the Greek AFM of the registered business (9 digits)."},"ES":{"label":"NIF (Business tax ID)","hint":"Enter the Spanish business NIF, formerly known as CIF for companies."},"FR":{"label":"SIRET","hint":"Enter the 14-digit SIRET identifying your registered French establishment."},"IT":{"label":"Partita IVA (VAT number)","hint":"Enter the 11-digit Italian Partita IVA of the business."},"PT":{"label":"NIPC / NIF","hint":"Enter the Portuguese company NIPC, or NIF if registered as self-employed."},"CY":{"label":"TIN / TIC","hint":"Enter the Cyprus tax identification code of the registered business."},"TR":{"label":"VKN (Tax number)","hint":"Enter the 10-digit Turkish VKN of the business."},"MT":{"label":"Business tax number","hint":"Enter the Maltese tax registration number used by your business."},"AU":{"label":"ABN (Australian Business Number)","hint":"Enter the 11-digit ABN of the Australian business."},"ME":{"label":"PIB (Tax number)","hint":"Enter the Montenegrin business PIB."},"AL":{"label":"NUIS / NIPT","hint":"Enter the Albanian business registration number (NUIS / NIPT)."},"US":{"label":"EIN / Business registration ID","hint":"Enter your Employer Identification Number (EIN) or applicable business registration ID."},"BS":{"label":"Business Licence number / TIN","hint":"Enter your Bahamas Business Licence number, or TIN if applicable to your registration."}};
  const ownerBankCountries=ownerCountryOptions;
  const ownerLocalBankCountries=['US','AU','BS'];
  const ownerTaxInfo=country=>ownerTaxIdDetails[country]||{label:'Business registration / Tax ID',hint:'Choose your registration country to see which number to enter.'};
  const ownerHasBankAccount=v=>!!(v?.iban_holder&&((v.iban&&/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v.iban)&&(!v.payout_bank_details||v.payout_bank_details.method==='iban'))||(v.payout_bank_details?.method==='local'&&ownerLocalBankCountries.includes(v.payout_bank_details.country)&&v.payout_bank_details.account_number&&v.payout_bank_details.routing_number&&!v.iban)));
  const ownerComplete=v=>!!(v?.business_country&&v.legal_business_name&&v.tax_identifier&&v.registered_address&&v.business_website&&ownerHasBankAccount(v)&&v.identity_type&&v.registration_path&&v.identity_path&&v.iban_proof_path);
  function ownerProgress(){
    const v=ownerVerificationRequest||{},s=ownerVerificationState();
    const steps=[['Business information',!!(v.business_country&&v.legal_business_name&&v.tax_identifier&&v.registered_address&&v.business_website),'business'],['Business bank account',ownerHasBankAccount(v),'payouts'],['Three verification documents',!!(v.registration_path&&v.identity_path&&v.iban_proof_path),'verification']];
    return `<div class="profile-panel verification-intro owner-verification-overview"><div class="verification-heading"><div><span class="member-page-kicker">PUBLISHING REQUIREMENTS</span><h2>${s==='approved'?'Your business is verified':'Get your business ready to publish'}</h2></div><span class="verification-badge ${esc(s)}">${esc(verificationLabel(s))}</span></div><div class="owner-progress" aria-label="Verification progress">${steps.map(([title,ready],i)=>`<button type="button" data-live="owner-jump" data-id="${['owner-business-details','owner-payout-details','owner-documents'][i]}" class="owner-progress-step ${ready?'complete':''}"><span aria-hidden="true">${ready?'✓':i+1}</span><span>${title}<small>${ready?'Saved':'To complete'}</small></span></button>`).join('')}</div>${s==='approved'?'<p class="verification-good">Your business is approved. You can publish listings. Changes to approved details or documents require another review.</p>':''}${s==='pending'?'<p class="member-note">Your application is awaiting staff review. If you make changes, remember to resubmit.</p>':''}${s==='rejected'&&ownerVerificationReview?.note?`<p class="verification-warning">Reviewer note: ${esc(ownerVerificationReview.note)}</p>`:''}</div>`;
  }
  function ownerBusinessForm(){
  const v=ownerVerificationRequest||{},code=v.business_country||'',tax=ownerTaxInfo(code);
  return ownerProgress()+`<form class="profile-panel live-form" data-live-form="owner-business" autocomplete="off"><h2>Business information</h2><p class="member-note">Choose where your business is registered, then enter its legal details. A business website is required.</p><div class="live-columns"><label>Business registration country<select name="business_country" required autocomplete="off" data-lpignore="true"><option value="" disabled ${!code?'selected':''}>Select country</option>${ownerCountryOptions.map(([value,label])=>`<option value="${value}" ${code===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${field('Legal business / trade name','legal_business_name','text',v.legal_business_name||'','required minlength="2" maxlength="180"')}</div><div class="live-columns"><label><span data-owner-tax-label>${esc(tax.label)}</span><input name="tax_identifier" type="text" value="${esc(v.tax_identifier||'')}" required maxlength="80" autocomplete="off" data-lpignore="true"><small class="owner-field-help" data-owner-tax-hint>${esc(tax.hint)}</small></label>${field('Business website (required)','business_website','text',v.business_website||'','required maxlength="300" placeholder="www.yourcompany.com" inputmode="url"')}</div><label>Registered business address<textarea name="registered_address" rows="2" required minlength="6" maxlength="350" placeholder="Street, postal code, city and country">${esc(v.registered_address||'')}</textarea></label><button class="btn" type="submit">Save business information</button><p data-feedback role="status"></p></form>`;
}
  function ownerBankRoutingLabel(country){
  if(country==='US')return 'Routing number (ABA)';
  if(country==='AU')return 'BSB (6 digits)';
  return 'Bank / branch code';
}
  function syncOwnerBusinessCountry(form){
  const details=ownerTaxInfo(form.querySelector('[name="business_country"]')?.value);
  const label=form.querySelector('[data-owner-tax-label]'),hint=form.querySelector('[data-owner-tax-hint]');
  if(label)label.textContent=details.label;
  if(hint)hint.textContent=details.hint;
}
  function syncOwnerBankCountry(form){
  const country=form.querySelector('[name="bank_country"]')?.value||'';
  const local=ownerLocalBankCountries.includes(country);
  const ibanGroup=form.querySelector('[data-owner-bank-iban]');
  const localGroup=form.querySelector('[data-owner-bank-local]');
  if(ibanGroup)ibanGroup.hidden=local;
  if(localGroup)localGroup.hidden=!local;
  for(const input of ibanGroup?.querySelectorAll('input')||[])input.required=!local;
  for(const input of localGroup?.querySelectorAll('input')||[])input.required=local&&input.name!=='swift_bic';
  const swift=localGroup?.querySelector('[name="swift_bic"]');
  if(swift)swift.required=country==='BS';
  const swiftLabel=form.querySelector('[data-owner-bank-swift-label]');
  if(swiftLabel)swiftLabel.textContent=country==='BS'?'SWIFT / BIC (required)':'SWIFT / BIC (if available)';
  const routingLabel=form.querySelector('[data-owner-bank-routing-label]');
  if(routingLabel)routingLabel.textContent=ownerBankRoutingLabel(country);
  const hint=form.querySelector('[data-owner-bank-hint]');
  if(hint)hint.textContent=country==='US'?'Enter your US business account number and 9-digit ABA routing number.':country==='AU'?'Enter your Australian business account number and 6-digit BSB.':country==='BS'?'Enter your Bahamas business account number, bank / branch code and SWIFT / BIC.':'Enter the IBAN of the business bank account. This may be in a different country from your business registration.';
}
  function ownerPayoutForm(){
  const v=ownerVerificationRequest||{},bank=v.payout_bank_details||{};
  const selected=bank.country||((v.iban||'').slice(0,2))||v.business_country||'';
  const bankCountry=ownerBankCountries.some(([code])=>code===selected)?selected:'';
  const local=ownerLocalBankCountries.includes(bankCountry);
  return ownerProgress()+`<form class="profile-panel live-form" data-live-form="owner-payouts" autocomplete="off"><h2>Business bank account</h2><p class="member-note">Select the country of your bank account, even if your business is registered elsewhere.</p><div class="live-columns"><label>Bank account country<select name="bank_country" required autocomplete="off" data-lpignore="true"><option value="" disabled ${!bankCountry?'selected':''}>Select bank country</option>${ownerBankCountries.map(([value,label])=>`<option value="${value}" ${bankCountry===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${field('Account holder (legal business name)','iban_holder','text',v.iban_holder||'','required minlength="2" maxlength="180" autocomplete="off" data-lpignore="true"')}</div><div class="owner-bank-fields" data-owner-bank-iban ${local?'hidden':''}><label>Business IBAN<input name="iban" type="text" value="${esc(v.iban||'')}" ${local?'':'required'} minlength="15" maxlength="42" autocomplete="off" autocapitalize="characters" spellcheck="false" data-lpignore="true"></label></div><div class="owner-bank-fields live-columns" data-owner-bank-local ${local?'':'hidden'}><label>Business bank account number<input name="account_number" type="text" value="${esc(bank.account_number||'')}" ${local?'required':''} minlength="4" maxlength="34" autocomplete="off" data-lpignore="true"></label><label><span data-owner-bank-routing-label>${esc(ownerBankRoutingLabel(bankCountry))}</span><input name="routing_number" type="text" value="${esc(bank.routing_number||'')}" ${local?'required':''} maxlength="80" autocomplete="off" data-lpignore="true"></label><label><span data-owner-bank-swift-label>SWIFT / BIC ${bankCountry==='BS'?'(required)':'(if available)'}</span><input name="swift_bic" type="text" value="${esc(bank.swift_bic||'')}" ${bankCountry==='BS'?'required':''} maxlength="11" autocomplete="off" autocapitalize="characters" spellcheck="false" data-lpignore="true"></label></div><p class="member-note owner-field-help" data-owner-bank-hint>${esc(bankCountry==='US'?'Enter your US business account number and 9-digit ABA routing number.':bankCountry==='AU'?'Enter your Australian business account number and 6-digit BSB.':bankCountry==='BS'?'Enter your Bahamas business account number, bank / branch code and SWIFT / BIC.':'Enter the IBAN of the business bank account. This may be in a different country from your business registration.')}</p><button class="btn" type="submit">Save bank details</button><p data-feedback role="status"></p></form>`;
}
  function ownerVerificationForm(){
    const v=ownerVerificationRequest||{},s=ownerVerificationState();
    const docs=[['registration','registration_path','Company / trade registration certificate'],['identity','identity_path','Owner / manager ID or passport'],['iban','iban_proof_path','Proof of business bank account']];
    const pieces=docs.map(([key,path,label],index)=>`<form class="owner-document-card live-form" data-live-form="owner-document" data-document="${key}" enctype="multipart/form-data"><div class="owner-document-head"><div class="owner-document-headerline"><span class="owner-document-number">0${index+1}</span><span class="verification-badge ${!v[path]?'missing':s==='approved'?'approved':'uploaded'}">${!v[path]?'Missing':s==='approved'?'Verified':'Uploaded'}</span></div><strong>${esc(label)}</strong><small>PDF, JPG, PNG or WebP · Max 5 MB</small></div>${key==='identity'?`<label>Document type<select name="identity_type"><option value="id_card" ${v.identity_type!=='passport'?'selected':''}>National ID card</option><option value="passport" ${v.identity_type==='passport'?'selected':''}>Passport</option></select></label>`:''}<label>${v[path]?'Replace document':'Select document'}<input type="file" name="document_file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><button class="btn live-secondary" type="submit">${v[path]?'Replace file':'Upload file'}</button><p data-feedback role="status"></p></form>`).join('');
    return ownerProgress()+`<section class="profile-panel owner-documents-panel"><div class="owner-documents-intro"><div><span class="owner-documents-eyebrow">SECURE DOCUMENT UPLOAD</span><h2>Business documents</h2><p>Upload the three required documents. You can replace each file individually whenever needed.</p></div><span class="owner-documents-private">${icon('shield')} Private & secure</span></div><div class="owner-documents-grid">${pieces}</div></section><form class="profile-panel live-form owner-submit-form" data-live-form="owner-submit"><h2>Send for review</h2><p class="member-note">You need complete business information, a business bank account, all three documents and your legal profile name before submitting.</p><label class="live-check"><input type="checkbox" name="documents_own" required> I am authorised to represent the business and confirm all submitted information is accurate.</label><button class="btn" type="submit" ${!ownerComplete(v)||s==='approved'||s==='pending'?'disabled':''}>${s==='rejected'?'Resubmit for review':'Submit for review'}</button>${!ownerComplete(v)?'<p class="member-note">Complete the items above to enable submission.</p>':''}${s==='pending'?'<p class="member-note">Already submitted. You will be notified after review.</p>':''}<p data-feedback role="status"></p></form>`;
  }
  function ownerBusinessWorkspace(){
    const overview=ownerProgress();
    const stages=[
      ['01','Business information','Add the legal company or trade details, including the mandatory website.','owner-business-details',ownerBusinessForm()],
      ['02','Business bank account','Choose your bank country and provide the account details for verification.','owner-payout-details',ownerPayoutForm()],
      ['03','Documents & review','Upload three private files separately, then submit one application.','owner-documents',ownerVerificationForm()]
    ];
    return `<div class="owner-workspace">${overview}<div class="owner-workspace-heading"><h2>Complete your business profile</h2><p>You do not need to finish everything today. Your saved information stays here until you're ready to submit.</p></div>${stages.map(([number,title,description,id,html])=>`<section id="${id}" class="owner-workflow-section"><div class="owner-workflow-heading"><span class="owner-step-number">${number}</span><div><h2>${title}</h2><p>${description}</p></div></div>${html.startsWith(overview)?html.slice(overview.length):html}</section>`).join('')}</div>`;
  }
  function accountProfile(tab){
    const d=profile.details||{};
    const isOwner=profile.account_type==='owner';
    const isPrivileged=superAdmin||verificationStaff;
    if(tab==='experience')tab='information';
    if(isPrivileged)tab='information';
    else if(isOwner&&['payouts','verification'].includes(tab))tab='business';
    let tabs=`<nav class="member-tabs ${isOwner?'owner-account-tabs':''}" aria-label="Profile sections">${(isPrivileged?[['information','Information']]:isOwner?[['information','Personal profile'],['business','Business & verification'],['password','Security']]:[['information','Information'],['verification','Verification'],['password','Password']]).map(([id,label])=>`<a href="#/account?tab=${id}" ${tab===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
    if(isOwner&&tab==='business')return tabs+ownerBusinessWorkspace();
    if(tab==='verification')return tabs+verificationForm();
    if(tab==='password')return tabs+`<form class="profile-panel live-form" data-live-form="password"><h2>Change your password</h2>${passwordChangeField('New password','password')}${passwordChangeField('Re-enter new password','confirm')}<button class="btn">Save password</button><p data-feedback role="status"></p></form><section class="profile-panel account-danger-zone"><div class="account-danger-intro"><h2>Delete account</h2><p>Want to leave Get By Boat? You can request permanent deletion of your account.</p></div><details class="account-delete-details"><summary>Continue to account deletion <span aria-hidden="true">›</span></summary><div class="account-delete-expanded"><p class="account-delete-notice">Account deletion is permanent. If you have a reservation, you must wait 24 hours after your final check-out.</p><div class="account-delete-email"><div><strong>Email verification</strong><p>We'll send a 6-digit code to <b>${esc(session.user.email||'')}</b>.</p></div></div><div class="account-code-row"><button type="button" class="btn live-secondary account-code-send" data-live="deletion-send-code">Send verification code</button><p data-delete-code-feedback role="status" aria-live="polite"></p></div><form data-live-form="delete-account" class="live-form account-delete-code-form" hidden><label class="account-delete-type">Verification code<input name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required placeholder="6-digit code"></label><p class="account-delete-hint">Valid for 10 minutes.</p><label class="account-delete-check"><input type="checkbox" name="understand" required><span>I understand that this action is permanent.</span></label><div class="account-delete-actions"><button type="submit" class="btn account-delete-button">Delete account permanently</button></div><p data-feedback role="status" aria-live="polite"></p></form></div></details></section>`;
    return tabs+`<form class="profile-panel live-form" data-live-form="avatar"><h2>Your profile photo</h2><div class="profile-photo-preview">${avatarUrl?`<img src="${esc(avatarUrl)}" alt="Your profile photo">`:'<span aria-hidden="true">◎</span>'}</div><label>Select an image<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><small style="font-size:12px">JPEG, PNG or WebP. Maximum 5 MB. Your photo is stored privately.</small><button class="btn">Save photo</button><p data-feedback role="status"></p></form><form class="profile-panel live-form" data-live-form="details" data-section="information"><h2>Personal information</h2><p class="member-note">Your name is filled from Google when available, or from the details you supplied during sign-up. You can edit it here.</p><div class="live-columns">${field('First name','first_name','text',d.first_name||'','required maxlength="100" autocomplete="given-name"')}${field('Surname','last_name','text',d.last_name||'','required maxlength="100" autocomplete="family-name"')}${field('Email','email','email',session.user.email||'','readonly')}${profileBirthField(d.birth_date||'')}${profileLanguagesField(d.languages||'')}${profilePhoneField(d.phone||'')}${field('Address','address','text',d.address||'','maxlength="200" autocomplete="street-address"')}${field('Postal code','postal_code','text',d.postal_code||'','maxlength="30" autocomplete="postal-code"')}${field('City','city','text',d.city||'','maxlength="100" autocomplete="address-level2"')}</div>${profileLanguageSuggestions()}<p class="member-note">Your personal details are private to your account.</p><button class="btn">Save details</button><p data-feedback role="status"></p></form>`;
  }
  const rentalOptions=b=>[b.with_skipper?'Rent with skipper':null,b.without_skipper!==false?'Rent without skipper':null].filter(Boolean).join(' · ');
  const ownerSkipperOption=b=>b.with_skipper&&b.without_skipper!==false?'With or without a skipper':b.with_skipper?'With a skipper':'Without a skipper';
  const captainCapIcon='<svg class="skipper-cap-icon" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M4.5 12V8.5C6.7 6.8 9.2 6 12 6s5.3.8 7.5 2.5V12" fill="#D8F3F8" stroke="#007D98" stroke-width="1.2"/><path d="M3 12.3c3.9-1.6 14.1-1.6 18 0v2.3c-5.3 3.5-12.7 3.5-18 0Z" fill="#00A6BF"/><path d="M9.7 9.6h4.6M12 7.3v4.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const guestTotal=amount=>Math.round((Number(amount)+serviceFee(Number(amount)))*100)/100;
  const bookingGuestTotal=(charter,skipper=0)=>{
    const boat=Math.max(0,Number(charter)||0),captain=Math.max(0,Number(skipper)||0);
    const subtotal=boat+captain+platformFee(boat);
    const processing=Math.max(0,priceCents(priceCents((subtotal+0.25)/0.985)-subtotal));
    return priceCents(subtotal+processing);
  };
  const guestDailyRate=amount=>guestTotal(amount);
  const boatClock=(value,fallback)=>/^([01]\d|2[0-3]):[0-5]\d/.test(String(value||''))?String(value).slice(0,5):fallback;
  const countryLabels=['Croatia','Greece','Spain','France','Italy','Portugal','Cyprus','Turkey','Malta','Australia','Montenegro','Albania','USA','Bahamas'];
  const destinationCities=[
    'Dubrovnik, Croatia','Split, Croatia','Trogir, Croatia','Zadar, Croatia','Murter, Croatia','Šibenik, Croatia','Hvar, Croatia','Rovinj, Croatia','Pula, Croatia','Makarska, Croatia','Korčula, Croatia','Biograd na Moru, Croatia','Vodice, Croatia','Poreč, Croatia','Opatija, Croatia',
    'Athens, Greece','Corfu, Greece','Mykonos, Greece','Santorini, Greece','Rhodes, Greece','Lefkada, Greece','Zakynthos, Greece','Kos, Greece','Paros, Greece',
    'Barcelona, Spain','Ibiza, Spain','Palma de Mallorca, Spain','Valencia, Spain','Malaga, Spain','Marbella, Spain','Alicante, Spain','Menorca, Spain',
    'Nice, France','Cannes, France','Marseille, France','Saint-Tropez, France','Ajaccio, France','Antibes, France','Bonifacio, France',
    'Naples, Italy','Amalfi, Italy','Sorrento, Italy','Palermo, Italy','Sardinia, Italy','Olbia, Italy','La Spezia, Italy','Portofino, Italy','Venice, Italy',
    'Lisbon, Portugal','Porto, Portugal','Lagos, Portugal','Faro, Portugal','Albufeira, Portugal','Madeira, Portugal',
    'Limassol, Cyprus','Larnaca, Cyprus','Paphos, Cyprus','Ayia Napa, Cyprus',
    'Bodrum, Turkey','Fethiye, Turkey','Marmaris, Turkey','Antalya, Turkey','Göcek, Turkey',
    'Valletta, Malta','Sliema, Malta','St. Julian’s, Malta','Sydney, Australia','Gold Coast, Australia','Whitsundays, Australia','Melbourne, Australia',
    'Kotor, Montenegro','Budva, Montenegro','Tivat, Montenegro','Herceg Novi, Montenegro',
    'Saranda, Albania','Vlorë, Albania','Durrës, Albania',
    'Miami, USA','Fort Lauderdale, USA','Key West, USA','Los Angeles, USA','San Diego, USA','New York, USA',
    'Nassau, Bahamas','Exuma, Bahamas','Freeport, Bahamas','Harbour Island, Bahamas',
    'Zagreb, Croatia','Rijeka, Croatia','Crikvenica, Croatia','Novi Vinodolski, Croatia','Kraljevica, Croatia','Krk, Croatia','Baška, Croatia','Malinska, Croatia','Cres, Croatia','Lošinj, Croatia','Mali Lošinj, Croatia','Rab, Croatia','Pag, Croatia','Novalja, Croatia','Senj, Croatia','Karlobag, Croatia','Nin, Croatia','Primošten, Croatia','Rogoznica, Croatia','Tribunj, Croatia','Pirovac, Croatia','Sukošan, Croatia','Bibinje, Croatia','Petrčane, Croatia','Zaton, Croatia','Omiš, Croatia','Brela, Croatia','Baška Voda, Croatia','Tučepi, Croatia','Podgora, Croatia','Gradac, Croatia','Ston, Croatia','Mljet, Croatia','Vis, Croatia','Komiža, Croatia','Brač, Croatia','Bol, Croatia','Supetar, Croatia','Jelsa, Croatia','Stari Grad, Croatia','Vela Luka, Croatia','Lumbarda, Croatia','Cavtat, Croatia','Slano, Croatia','Umag, Croatia','Novigrad, Croatia','Fažana, Croatia','Medulin, Croatia','Labin, Croatia','Rabac, Croatia','Istanbul, Turkey','İzmir, Turkey','Çeşme, Turkey','Kuşadası, Turkey','Didim, Turkey','Kaş, Turkey','Kalkan, Turkey','Alanya, Turkey','Side, Turkey','Adana, Turkey','Mersin, Turkey','Datça, Turkey','Bozburun, Turkey','Dalyan, Turkey','Alaçatı, Turkey','Trabzon, Turkey','Thessaloniki, Greece','Piraeus, Greece','Chania, Greece','Heraklion, Greece','Rethymno, Greece','Volos, Greece','Kavala, Greece','Preveza, Greece','Nafplio, Greece','Patras, Greece','Skiathos, Greece','Skopelos, Greece','Naxos, Greece','Syros, Greece','Kefalonia, Greece','Ithaca, Greece','Halkidiki, Greece','Rome, Italy','Genoa, Italy','Bari, Italy','Brindisi, Italy','Cagliari, Italy','Catania, Italy','Messina, Italy','Trapani, Italy','Lecce, Italy','Livorno, Italy','Trieste, Italy','Rimini, Italy','Ravenna, Italy','Ancona, Italy','Seville, Spain','Madrid, Spain','Cadiz, Spain','Cartagena, Spain','Tarragona, Spain','Girona, Spain','Bilbao, Spain','San Sebastián, Spain','Paris, France','Bordeaux, France','La Rochelle, France','Toulon, France','Montpellier, France','Brest, France','Nantes, France','Biarritz, France','Setúbal, Portugal','Cascais, Portugal','Portimão, Portugal','Funchal, Portugal','Aveiro, Portugal','Nicosia, Cyprus','Polis, Cyprus','Protaras, Cyprus','Mdina, Malta','Mellieħa, Malta','Marsaxlokk, Malta','Gozo, Malta','Podgorica, Montenegro','Bar, Montenegro','Ulcinj, Montenegro','Perast, Montenegro','Tirana, Albania','Himarë, Albania','Ksamil, Albania','Shëngjin, Albania','Brisbane, Australia','Perth, Australia','Adelaide, Australia','Cairns, Australia','Darwin, Australia','Hobart, Australia','Orlando, USA','Tampa, USA','San Francisco, USA','Seattle, USA','Honolulu, USA','Marsh Harbour, Bahamas','Eleuthera, Bahamas','Bimini, Bahamas'
  ];
  window.GBB_DESTINATION_CITIES=destinationCities;
  const destinationSearchCountries=['Croatia','Greece','Spain','France','Italy','Malta','Portugal','Cyprus','Montenegro','Turkey','Albania','Australia','Bahamas','United States'];
  const destinationDatalist=()=>`<datalist id="boat-destinations">${[...destinationSearchCountries,...destinationCities].map(city=>`<option value="${esc(city)}"></option>`).join('')}</datalist>`;
  const countryMapCenters={Croatia:[43.8,15.9,8],Greece:[37.9,23.7,7],Spain:[39.4,-4,6],France:[43.3,5.1,7],Italy:[41.9,12.5,6],Portugal:[38.7,-9.2,7],Cyprus:[34.9,33.25,9],Turkey:[37,29,6],Malta:[35.9,14.5,11],Australia:[-25.27,133.77,4],Montenegro:[42.4,18.7,9],Albania:[40.8,19.5,9],USA:[37.1,-95.7,4],Bahamas:[24.25,-76.1,7]};
  const validPickupCoordinates=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  const boatPickupCoordinates=boat=>{
    if(boat.pickup_latitude===null||boat.pickup_latitude===undefined||boat.pickup_longitude===null||boat.pickup_longitude===undefined)return null;
    const lat=Number(boat.pickup_latitude),lng=Number(boat.pickup_longitude);
    return validPickupCoordinates(lat,lng)?[lat,lng]:null;
  };
  const publicTownCenters={'murter,croatia':[43.82,15.59],'sydney,australia':[-33.87,151.21],'split,croatia':[43.51,16.44],'dubrovnik,croatia':[42.65,18.09],'zadar,croatia':[44.12,15.23],'trogir,croatia':[43.52,16.25]};
  const publicTownPoint=b=>{
    const town=publicTownCenters[`${String(b.location||'').toLowerCase().trim()},${String(b.country||'').toLowerCase().trim()}`];
    if(town)return town;
    const lat=Number(b.city_map_lat),lng=Number(b.city_map_lng);
    if(b.city_map_lat!=null&&b.city_map_lng!=null&&validPickupCoordinates(lat,lng))return [lat,lng];
    return countryMapCenters[b.country]?.slice(0,2)||countryMapCenters.Croatia.slice(0,2);
  };
  const terrainTiles=map=>window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,subdomains:'abc',attribution:'Terrain: &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> · &copy; OpenStreetMap contributors'}).addTo(map);
  const guestMapTiles=map=>window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
  // Browser key must be restricted in Google Cloud to this domain and Maps JavaScript API.
  const googleMapsKey=()=>String(window.GBB_GOOGLE_MAPS_API_KEY||'').trim();
  let googleMapsLoader=null;
  const googleMapsApi=()=>{
    if(!googleMapsKey())return Promise.resolve(null);
    if(window.google?.maps?.Map)return Promise.resolve(window.google.maps);
    if(googleMapsLoader)return googleMapsLoader;
    googleMapsLoader=new Promise(resolve=>{
      const callback='__gbbGoogleMapsLoaded';
      let finished=false;
      const finish=maps=>{
        if(finished)return;
        finished=true;
        clearTimeout(timeout);
        delete window[callback];
        resolve(maps?.Map?maps:null);
      };
      const timeout=setTimeout(()=>finish(null),12000);
      window[callback]=()=>finish(window.google?.maps);
      const script=document.createElement('script');
      script.async=true;
      script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey())}&v=weekly&loading=async&callback=${callback}`;
      script.onerror=()=>finish(null);
      document.head.appendChild(script);
    });
    return googleMapsLoader;
  };
  const blueGoogleMarkerIcon=maps=>({
    url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="45" viewBox="0 0 36 45"><path d="M18 2C9.2 2 2 9.2 2 18c0 12 16 25 16 25s16-13 16-25C34 9.2 26.8 2 18 2z" fill="#0097b6" stroke="#fff" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="#fff"/></svg>'),
    scaledSize:new maps.Size(36,45),anchor:new maps.Point(18,43)
  });
  const equipmentCategories=[
    ['Outdoor equipment',[['bimini','Bimini'],['outdoor_shower','Outdoor shower'],['outdoor_table','External table'],['outdoor_speakers','External speakers'],['teak_deck','Teak deck'],['bow_sundeck','Bow sundeck'],['aft_sundeck','Aft sundeck'],['swim_platform','Bathing platform'],['swim_ladder','Bathing ladder']]],
    ['Extra comforts',[['air_conditioning','Air conditioning'],['heating','Heating'],['electric_toilet','Toilet'],['bed_linen','Bed linen'],['bath_towels','Bath towels'],['wifi','Wi-Fi'],['usb','USB socket'],['tv','TV']]],
    ['Navigation',[['dinghy','Dinghy'],['bow_thruster','Bow thruster'],['electric_windlass','Electric windlass'],['autopilot','Autopilot'],['gps','GPS'],['depth_sounder','Depth sounder'],['vhf','VHF'],['satellite_phone','Satellite phone'],['guides_maps','Map']]],
    ['Kitchen',[['fridge','Fridge'],['freezer','Freezer'],['oven','Oven/stovetop'],['bbq','BBQ grill'],['microwave','Microwave'],['coffee_machine','Coffee machine'],['ice_machine','Ice machine'],['ice_box','Ice box']]],
    ['Leisure activities',[['paddleboard','Paddle board'],['kayak','Kayak'],['snorkel','Snorkelling equipment'],['fishing','Fishing equipment'],['diving','Diving equipment'],['seabob','Seabob']]],
    ['Onboard energy',[['generator','Generator'],['power_220v','220V power outlet']]],
    ['Water sports',[['water_skis','Water skis'],['wakeboard','Wakeboard'],['towable_tube','Tube'],['banana','Inflatable banana'],['kneeboard','Kneeboard']]]
  ];
  const allowedEquipment=new Set(equipmentCategories.flatMap(([,options])=>options.map(([id])=>id)));
  const equipmentIconPaths={
    bimini:'<path d="M3 17c2-11 16-11 18 0M6 17v4M18 17v4M12 2v3M4 5l2 2M20 5l-2 2"/>',
    outdoor_shower:'<path d="M4 22V9a5 5 0 0 1 10 0M11 9h7l2 3H9zM12 15v2M16 15v3M20 15v2"/>',
    outdoor_table:'<path d="M3 8h18v4H3zM6 12l-2 9M18 12l2 9M6 17h12"/>',
    outdoor_speakers:'<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><circle cx="6.5" cy="14" r="2"/><circle cx="17.5" cy="14" r="2"/>',
    teak_deck:'<circle cx="12" cy="12" r="9"/><path d="m6 19 12-14M4 13l9-9M11 21l9-9"/>',
    bow_sundeck:'<circle cx="17" cy="5" r="2"/><path d="M17 1v1M12 5h2M21 5h2M8 19c4-5 8-1 12-6M3 21h18M5 14c3-4 6-4 9-1"/>',
    aft_sundeck:'<circle cx="17" cy="5" r="2"/><path d="M3 20h18M5 16h14M8 12h8M8 12l-3 4M16 12l3 4"/>',
    swim_platform:'<path d="M3 10h18v6H3zM7 10V7M17 10V7M2 20c2-2 4-2 6 0s4 2 6 0 4-2 8 0"/>',
    swim_ladder:'<path d="M5 22V5a3 3 0 0 1 6 0v5M19 22V5a3 3 0 0 0-6 0M5 11h14M5 16h14M2 22h20"/>',
    fridge:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M12 13v6M9 16h6"/>',
    usb:'<path d="M12 21V4M12 4l-3 3M12 4l3 3M12 11H6V8M12 15h6v-3M6 8h2M18 12h2M9 21h6"/>',
    wifi:'<path d="M2 8c6-5 14-5 20 0M5 12c4-4 10-4 14 0M9 16c2-2 4-2 6 0"/><circle cx="12" cy="20" r="1"/>',
    gps:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 6-5 2 2-5z"/>',
    tv:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>',
    air_conditioning:'<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
    hot_water:'<path d="M7 5c-3 5 3 7 0 12M13 3c-3 5 3 7 0 12M19 5c-3 5 3 7 0 12"/>',
    kayak:'<path d="M3 12c5-5 13-5 18 0-5 5-13 5-18 0ZM3 5l18 14M18 3l4 4M2 17l4 4"/>',
    paddleboard:'<path d="M3 15c5-9 13-9 18 0-5 5-13 5-18 0ZM15 4l-6 17"/>',
    generator:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m13 8-4 5h4l-2 4"/>',
    bbq:'<path d="M4 9h16a8 8 0 0 1-16 0ZM8 17v5M16 17v5M8 4l2 3M14 3l2 4"/>',
    fishing:'<path d="M3 21c2-12 7-19 17-19M13 7v10a3 3 0 0 0 6 0"/>',
    watermaker:'<path d="M12 3C8 8 6 11 6 15a6 6 0 0 0 12 0c0-4-2-7-6-12ZM8 17c1 2 3 3 5 3"/>',
    fans:'<circle cx="12" cy="12" r="2"/><path d="M12 10c-3-7 2-9 5-6 2 3-1 6-3 7M14 12c7-3 9 2 6 5-3 2-6-1-7-3M11 14c3 7-2 9-5 6-2-3 1-6 3-7M10 11C3 14 1 9 4 6c3-2 6 1 7 3"/>',
    heating:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 8v8M12 8v8M16 8v8M6 21h2M16 21h2"/>',
    electric_toilet:'<path d="M5 4h8v9a5 5 0 0 1-10 0V9h2M9 18v4h10M15 12h4v4M15 4h4v5"/>',
    bed_linen:'<path d="M3 19V9h18v10M3 14h18M5 9V6h6v3M13 6h6v3M3 21v-2M21 21v-2"/>',
    bath_towels:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h6"/>',
    beach_towels:'<path d="M4 18 15 3l6 5-11 14-6-4ZM7 14l6 5M11 8l6 5"/>',
    dinghy:'<path d="M3 13h18l-3 6H7l-4-6ZM8 13l3-7h4l3 7M3 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    dinghy_motor:'<path d="M3 12h13l-3 6H7l-4-6ZM16 5h5v9h-5M18 14v7M18 21l-3-2M18 21l3-2"/>',
    bow_thruster:'<circle cx="12" cy="12" r="9"/><path d="m12 12 4-5-1 6-3-1ZM12 12l5 4-6-1 1-3ZM12 12l-4 5 1-6 3 1ZM12 12 7 8l6 1-1 3Z"/>',
    electric_windlass:'<path d="M12 3v15M8 7h8M4 13a8 8 0 0 0 16 0M4 13l-2 3M20 13l2 3M10 21h4"/>',
    autopilot:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M8 16l4-9 4 9-4-2-4 2Z"/>',
    depth_sounder:'<path d="M3 6h18M3 10c3-3 5 3 8 0s5 3 10 0M5 15v5M9 18l3 3 3-3M19 15v5"/>',
    vhf:'<rect x="6" y="7" width="12" height="14" rx="2"/><path d="M9 7V3M9 3l5-1M9 11h6M10 17h4"/>',
    satellite_phone:'<rect x="7" y="6" width="10" height="16" rx="2"/><path d="M10 6V3l5-2M10 17h4M4 10c-2 2-2 4 0 6M20 10c2 2 2 4 0 6"/>',
    guides_maps:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/>',
    freezer:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M12 13v6M9 16h6M10 14l4 4M14 14l-4 4"/>',
    oven:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M7 6h.01M11 6h.01M8 13h8v5H8z"/>',
    microwave:'<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="8" width="11" height="8" rx="1"/><path d="M19 9h.01M19 13h.01"/>',
    coffee_machine:'<path d="M5 8h12v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8ZM17 10h3a3 3 0 0 1 0 6h-3M8 3c-2 2 2 3 0 5M13 3c-2 2 2 3 0 5"/>',
    ice_machine:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 7v10M7 12h10M8 8l8 8M16 8l-8 8"/>',
    ice_box:'<path d="M3 9h18v12H3zM2 6h20v3H2zM8 6V3h8v3M10 14h4"/>',
    snorkel:'<path d="M3 9h13v7a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5V9ZM16 11h4V3h2M7 13h5"/>',
    diving:'<path d="M4 11h16v6H4zM8 11V7M16 11V7M5 20l3-3M19 20l-3-3M9 3h6"/>',
    seabob:'<path d="M3 12c6-7 12-7 18 0-6 7-12 7-18 0ZM8 12h8M12 8v8M4 18l-2 3M20 18l2 3"/>',
    bike:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-9 5 9H5M15 17l4-9M8 8h4M12 5h3"/>',
    scooter:'<circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M5 19h12l-3-14h5M14 5h6M8 19l3-5"/>',
    drone:'<circle cx="12" cy="12" r="3"/><circle cx="4" cy="4" r="3"/><circle cx="20" cy="4" r="3"/><circle cx="4" cy="20" r="3"/><circle cx="20" cy="20" r="3"/><path d="M6 6l4 4M14 10l4-4M6 18l4-4M14 14l4 4"/>',
    camera:'<rect x="2" y="6" width="20" height="15" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6 9 3h6l1 3"/>',
    inverter:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m13 7-4 6h4l-2 4"/>',
    power_220v:'<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 16c1 2 5 2 6 0"/>',
    water_skis:'<path d="M5 3 2 21M11 3 8 21M16 4l-2 17M22 4l-2 17"/>',
    monoski:'<path d="M9 2 6 22M15 2l-3 20M4 17c5 3 11 3 16 0"/>',
    wakeboard:'<path d="M3 15c3-9 15-9 18 0-3 6-15 6-18 0ZM10 8l4 11M4 3l16 18"/>',
    towable_tube:'<circle cx="12" cy="11" r="8"/><circle cx="12" cy="11" r="3"/><path d="M3 22c3-3 5-3 8 0s5-3 10 0"/>',
    banana:'<path d="M3 7c6 13 14 13 18 0-3 16-15 20-18 0ZM3 22c3-2 6-2 9 0s6 2 9 0"/>',
    kneeboard:'<path d="M3 15c5-6 13-6 18 0l-3 4H6l-3-4ZM9 9l3-4 3 4M3 22h18"/>'
  };
  const equipmentIcon=id=>`<svg class="listing-amenity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${equipmentIconPaths[id]||ICONS[{gps:'pin',camera:'star',satellite_phone:'message',power_220v:'spark',bed_linen:'bed',bath_towels:'bath'}[id]||'check']}</svg>`;
  const listingEquipmentSection=boat=>{
    const selected=new Set(Array.isArray(boat.specifications?.equipment)?boat.specifications.equipment:[]);
    const all=equipmentCategories.flatMap(([,options])=>options.filter(([id])=>selected.has(id)));
    const priority=['bimini','outdoor_shower','fridge','swim_ladder','outdoor_table','usb','bow_sundeck','outdoor_speakers','swim_platform','teak_deck'];
    all.sort((a,b)=>{const x=priority.indexOf(a[0]),y=priority.indexOf(b[0]);return (x<0?100:x)-(y<0?100:y)});
    const rows=items=>`<ul class="listing-amenity-grid">${items.map(([id,label])=>`<li>${equipmentIcon(id)}<span>${esc(label)}</span></li>`).join('')}</ul>`;
    const rest=all.slice(10);
    const disclosure=rest.length?`<details class="listing-amenity-more"><summary>Show all ${all.length} amenities ${icon('chevron')}</summary>${rows(rest)}</details>`:'';
    return `<section class="listing-equipment"><h2>Equipment available on the ${esc(boat.type||'boat')}</h2>${all.length?`${rows(all.slice(0,10))}${disclosure}`:'<p class="listing-detail-empty">Equipment has not been listed yet. Ask the owner what is included.</p>'}</section>`;
  };
  const shiftMonth=(month,offset)=>{
    const [year,number]=month.split('-').map(Number);
    return new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7);
  };
  function listingCalendarMonth(month,unavailable){
    const [year,number]=month.split('-').map(Number);
    const first=new Date(Date.UTC(year,number-1,1)),length=new Date(Date.UTC(year,number,0)).getUTCDate();
    const padding=(first.getUTCDay()+6)%7;
    const name=first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
    const cells=Array.from({length:padding},()=>'<span aria-hidden="true"></span>');
    for(let day=1;day<=length;day++){
      const iso=`${month}-${String(day).padStart(2,'0')}`;
      const busy=unavailable.some(r=>r.start_date<=iso&&r.end_date>=iso),past=iso<today();
      cells.push(busy||past?`<span class="listing-calendar-date ${busy?'is-unavailable':'is-past'}" title="${busy?'Unavailable':'Past date'}" aria-label="${esc(euroDate(iso))}: ${busy?'unavailable':'past'}">${day}</span>`:`<button type="button" class="listing-calendar-date" data-listing-date="${iso}" aria-label="Select ${esc(euroDate(iso))}" aria-pressed="false">${day}</button>`);
    }
    return `<div class="listing-calendar-month"><h3>${esc(name)}</h3><div class="listing-calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<span>${d}</span>`).join('')}</div><div class="listing-calendar-days">${cells.join('')}</div></div>`;
  }
  function listingAvailabilityCalendar(unavailable,month){
    const selected=/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')?month:today().slice(0,7);
    return `<section class="listing-calendar" id="boat-availability"><div class="listing-calendar-header"><div><h2>Availability calendar</h2><p>Choose your rental dates. Crossed-out dates are unavailable.</p></div><div class="listing-calendar-arrows"><button type="button" data-listing-month="${shiftMonth(selected,-1)}" aria-label="Previous month">‹</button><button type="button" data-listing-month="${shiftMonth(selected,1)}" aria-label="Next month">›</button></div></div><div class="listing-calendar-pair">${listingCalendarMonth(selected,unavailable)}${listingCalendarMonth(shiftMonth(selected,1),unavailable)}</div><p class="listing-calendar-hint" data-listing-calendar-hint role="status">Select the first day, then the last day of your rental.</p></section>`;
  }
  const stars=rating=>`<span class="listing-review-stars" aria-label="${Number(rating)} out of 5 stars">${Array.from({length:5},(_,i)=>`<span class="${i<Math.round(Number(rating))?'is-filled':''}">★</span>`).join('')}</span>`;
  function listingOwnerReviews(reviews){
    const rating=reviews.length?reviews.reduce((sum,r)=>sum+Number(r.rating),0)/reviews.length:0;
    const items=reviews.slice(0,12).map(r=>{
      const month=new Date(r.created_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'});
      return `<article class="listing-review"><div class="listing-review-head">${stars(r.rating)}<span>Verified renter · ${esc(month)}</span></div>${r.comment?`<p>${esc(r.comment)}</p>`:'<p class="listing-review-muted">Rated after a completed rental.</p>'}</article>`;
    }).join('');
    return `<section class="listing-owner-reviews" id="boat-owner-reviews"><div class="listing-reviews-title"><h2>Owner reviews</h2>${reviews.length?`<strong>${stars(rating)} ${rating.toFixed(1)} <small>(${reviews.length} ${reviews.length===1?'review':'reviews'})</small></strong>`:''}</div>${reviews.length?`<div class="listing-review-grid">${items}</div>`:'<p class="listing-detail-empty">No reviews yet. Guests can rate the owner after a completed booking.</p>'}</section>`;
  }
  const listingSpecificationSections=boat=>{
    const specs=boat.specifications&&typeof boat.specifications==='object'&&!Array.isArray(boat.specifications)?boat.specifications:{};
    const numeric=(value,unit='')=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?`${Number(value).toLocaleString('en-GB',{maximumFractionDigits:2})}${unit?` ${unit}`:''}`:'';
    const engineTypes={outboard:'Outboard',inboard:'Inboard',electric:'Electric',none:'No engine',other:'Other'};
    const technicalRows=[
      ['Boat type',String(boat.type||'')],
      ['Maximum passengers',numeric(boat.guests)],
      ['Engine type',engineTypes[specs.engine_type]||''],
      ['Engine power',numeric(specs.engine_hp,'hp')],
      ['Cabins',Number(specs.cabins)>0?numeric(specs.cabins):''],
      ['Berths',Number(specs.berths)>0?numeric(specs.berths):''],
      ['Length',numeric(specs.length_m,'m')],
      ['Width',numeric(specs.width_m,'m')],
      ['Draft',numeric(specs.draft_m,'m')],
      ['Tank capacity',numeric(specs.tank_capacity_l,'L')],
      ['Fuel consumption',numeric(specs.fuel_lph,'L/h')],
      ['Top speed',numeric(specs.speed_knots,'knots')],
      ['Crew members',numeric(specs.crew)],
      ['Year built',Number.isInteger(Number(specs.build_year))&&specs.build_year!==null&&specs.build_year!==undefined&&specs.build_year!==''?String(Number(specs.build_year)):'']
    ].filter(([,value])=>value!=='');
    const detailRows=rows=>`<dl class="listing-spec-grid">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
    const insuranceLabels={not_specified:'Not specified',none:'Not insured',third_party:'Third-party insurance',comprehensive:'Fully comprehensive'};
    const insurance=insuranceLabels[boat.insurance_type]||'Not specified';
    const deposit=Number(boat.security_deposit);
    const depositLabel=boat.security_deposit==null||!Number.isFinite(deposit)?'Ask the owner':deposit>0?money(deposit):'No deposit required';
    return `<section class="listing-technical"><div class="listing-section-title">${icon('ship')}<h2>Technical specifications</h2></div>${technicalRows.length?detailRows(technicalRows):'<p class="listing-detail-empty">Technical details have not been added yet. You can ask the owner before booking.</p>'}</section><section class="listing-insurance"><div class="listing-section-title">${icon('shield')}<h2>Insurance &amp; security deposit</h2></div>${detailRows([['Insurance coverage',insurance],['Refundable security deposit',depositLabel]])}</section>`;
  };
  const pickupDetails=(boat,exactPickup=null)=>{
    const exactCoordinates=exactPickup&&exactPickup.latitude!=null&&exactPickup.longitude!=null?[Number(exactPickup.latitude),Number(exactPickup.longitude)]:null;
    const coordinates=exactCoordinates&&validPickupCoordinates(...exactCoordinates)?exactCoordinates:publicTownPoint(boat);
    const exact=!!exactPickup;
    const address=exact?String(exactPickup.pickup_address||boat.location||'').trim():'';
    const mapsQuery=exactCoordinates?exactCoordinates.join(','):[address,boat.location,boat.country].filter(Boolean).join(', ');
    return `<section class="fleet-public-pickup"><div class="listing-map-heading"><div><h3>${exact?'Your meeting point':'Where is the boat?'}</h3><p>${icon('pin')} ${exact?esc(address):esc(boat.location+', '+boat.country)}</p></div><span class="listing-location-badge">${exact?'Exact location unlocked':'Approximate 5 km area'}</span></div><div class="fleet-public-map" data-public-map data-lat="${coordinates[0]}" data-lng="${coordinates[1]}" data-exact="${exact&&!!exactCoordinates}" role="img" aria-label="${exact?'Exact pickup map':'Approximate boat area shown as a blue circle'}"></div>${exact?`<a class="listing-map-link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}">${icon('pin')} Get directions in Google Maps ↗</a>`:'<p class="listing-map-disclaimer">The shaded circle shows the approximate town area. The exact marina and meeting address are shared after payment and booking confirmation.</p>'}</section>`;
  };
  function initPublicPickupMapLeaflet(container){
    if(!container?.isConnected||!window.L)return;
    const lat=Number(container.dataset.lat),lng=Number(container.dataset.lng),exact=container.dataset.exact==='true';
    if(!validPickupCoordinates(lat,lng))return;
    const map=window.L.map(container,{scrollWheelZoom:false}).setView([lat,lng],exact?12:10);
    guestMapTiles(map);
    if(exact)window.L.marker([lat,lng]).addTo(map);
    else window.L.circle([lat,lng],{radius:5000,color:'#0588c7',weight:2.5,fillColor:'#30a6df',fillOpacity:.27,interactive:false}).addTo(map);
    publicPickupMap=map;
    setTimeout(()=>map.invalidateSize(),0);
  }
  function initPublicPickupMap(){
    const container=document.querySelector('[data-public-map]');
    if(!container)return;
    if(!googleMapsKey()){initPublicPickupMapLeaflet(container);return;}
    googleMapsApi().then(maps=>{
      if(!container.isConnected||publicPickupMap)return;
      if(!maps){initPublicPickupMapLeaflet(container);return;}
      const lat=Number(container.dataset.lat),lng=Number(container.dataset.lng),exact=container.dataset.exact==='true';
      if(!validPickupCoordinates(lat,lng))return;
      const center={lat,lng};
      const map=new maps.Map(container,{center,zoom:exact?12:10,mapTypeId:'terrain',mapTypeControl:false,streetViewControl:false,fullscreenControl:false,zoomControl:true,gestureHandling:'cooperative'});
      const marker=exact?new maps.Marker({map,position:center,icon:blueGoogleMarkerIcon(maps),title:'Boat pickup point'}):null;
      const circle=!exact?new maps.Circle({map,center,radius:5000,strokeColor:'#0588c7',strokeOpacity:1,strokeWeight:2.5,fillColor:'#30a6df',fillOpacity:.27,clickable:false}):null;
      publicPickupMap={remove(){marker?.setMap(null);circle?.setMap(null);maps.event.clearInstanceListeners(map);}};
    });
  }
  function initOwnerPickupMapLeaflet(form,container){
    if(!container?.isConnected)return;
    if(!window.L){container.textContent='Map could not load. Please try again in a moment.';return;}
    const latitude=form.querySelector('[name="pickup_latitude"]'),longitude=form.querySelector('[name="pickup_longitude"]');
    const status=form.querySelector('[data-pickup-status]');
    const country=String(form.querySelector('[name="country"]')?.value||'');
    const countryCenter=countryMapCenters[country]||countryMapCenters.Croatia;
    const saved=latitude.value!==''&&longitude.value!==''&&validPickupCoordinates(Number(latitude.value),Number(longitude.value));
    const center=saved?[Number(latitude.value),Number(longitude.value)]:countryCenter.slice(0,2);
    const map=window.L.map(container,{scrollWheelZoom:false}).setView(center,saved?12:countryCenter[2]);
    terrainTiles(map);
    const approximateArea=window.L.circle(center,{radius:5000,color:'#0588c7',weight:2,fillColor:'#30a6df',fillOpacity:.12,interactive:false}).addTo(map);
    const marker=window.L.marker(center,{draggable:true,autoPan:true}).addTo(map);
    const setCoordinates=position=>{
      latitude.value=position.lat.toFixed(6);
      longitude.value=position.lng.toFixed(6);
      approximateArea.setLatLng(position);
      if(status)status.textContent=`Exact pickup pin: ${latitude.value}, ${longitude.value}. Save the listing to keep this location.`;
    };
    marker.on('dragend',()=>setCoordinates(marker.getLatLng()));
    map.on('click',event=>{marker.setLatLng(event.latlng);setCoordinates(event.latlng);});
    if(status)status.textContent=saved?`Saved pickup pin: ${latitude.value}, ${longitude.value}. Drag it to adjust.`:'Drag the pin or click the map to mark the exact marina. The approximate country centre will not be saved until you choose a location.';
    ownerPickupMap={map,marker,form,setCoordinates};
    setTimeout(()=>map.invalidateSize(),0);
  }
  function initOwnerPickupMap(){
    const form=document.querySelector('[data-live-form="boat"]');
    const container=form?.querySelector('[data-pickup-map]');
    if(!container)return;
    if(!googleMapsKey()){initOwnerPickupMapLeaflet(form,container);return;}
    googleMapsApi().then(maps=>{
      if(!container.isConnected||ownerPickupMap)return;
      if(!maps){initOwnerPickupMapLeaflet(form,container);return;}
      const latitude=form.querySelector('[name="pickup_latitude"]'),longitude=form.querySelector('[name="pickup_longitude"]');
      const status=form.querySelector('[data-pickup-status]');
      const country=String(form.querySelector('[name="country"]')?.value||'');
      const countryCenter=countryMapCenters[country]||countryMapCenters.Croatia;
      const saved=latitude.value!==''&&longitude.value!==''&&validPickupCoordinates(Number(latitude.value),Number(longitude.value));
      const initial=saved?[Number(latitude.value),Number(longitude.value)]:countryCenter.slice(0,2);
      const center={lat:initial[0],lng:initial[1]};
      const map=new maps.Map(container,{center,zoom:saved?13:countryCenter[2],mapTypeId:'terrain',mapTypeControl:false,streetViewControl:false,fullscreenControl:false,zoomControl:true,gestureHandling:'cooperative'});
      const marker=new maps.Marker({map,position:center,draggable:true,icon:blueGoogleMarkerIcon(maps),title:'Drag to the exact marina'});
      const setCoordinates=position=>{
        latitude.value=position.lat.toFixed(6);
        longitude.value=position.lng.toFixed(6);
        if(status)status.textContent=`Exact pickup pin: ${latitude.value}, ${longitude.value}. Save the listing to keep this location.`;
      };
      marker.addListener('dragend',()=>{
        const pos=marker.getPosition();
        if(pos)setCoordinates({lat:pos.lat(),lng:pos.lng()});
      });
      map.addListener('click',event=>{
        if(!event.latLng)return;
        const point={lat:event.latLng.lat(),lng:event.latLng.lng()};
        marker.setPosition(point);
        setCoordinates(point);
      });
      if(status)status.textContent=saved?`Saved pickup pin: ${latitude.value}, ${longitude.value}. Drag it to adjust.`:'Drag the pin or click the map to mark the exact marina. The approximate country centre will not be saved until you choose a location.';
      ownerPickupMap={
        map:{setView(point,zoom){map.setCenter({lat:point[0],lng:point[1]});if(zoom)map.setZoom(zoom);},invalidateSize(){},remove(){marker.setMap(null);maps.event.clearInstanceListeners(marker);maps.event.clearInstanceListeners(map);}},
        marker:{setLatLng(point){marker.setPosition(Array.isArray(point)?{lat:point[0],lng:point[1]}:point);}},
        form,setCoordinates
      };
    });
  }
  function updateOwnerSkipperFee(form){
    if(!form)return;
    const selectedMode=form.querySelector('[name="skipper_mode"]:checked')?.value;
    const withInput=form.querySelector('[name="with_skipper"]'),withoutInput=form.querySelector('[name="without_skipper"]');
    if(selectedMode&&withInput&&withoutInput){withInput.checked=selectedMode!=='self';withoutInput.checked=selectedMode!=='included';}
    const withSkipper=!!withInput?.checked;
    const withoutSkipper=!!form.querySelector('[name="without_skipper"]')?.checked;
    const separate=withSkipper&&withoutSkipper;
    const fee=form.querySelector('[name="skipper_fee_per_day"]');
    if(fee){fee.disabled=!separate;fee.required=separate;fee.min=separate?'0.01':'0';if(!separate)fee.value='0';}
    const wrapper=form.querySelector('[data-skipper-fee-wrapper]');
    if(wrapper)wrapper.hidden=!separate;
    const included=form.querySelector('[data-skipper-included]');
    if(included)included.hidden=!(withSkipper&&!withoutSkipper);
    const includedCheck=form.querySelector('[name="skipper_included_ack"]');
    if(includedCheck){includedCheck.checked=withSkipper&&!withoutSkipper;includedCheck.required=false;}
    const note=form.querySelector('[data-skipper-fee-note]');
    if(note)note.textContent='The optional skipper is paid separately at check-in. No platform commission applies to the skipper fee.';
    const summary=form.querySelector('[data-rental-mode-summary]');
    if(summary)summary.textContent=separate?'Skipper optional · guests can also self-drive.':withSkipper?'Skipper included in boat price.':withoutSkipper?'Self-drive only.':'Choose one option.';
  }
  function syncEquipmentPicker(form){
    const picker=form?.querySelector?.('[data-equipment-picker]');
    if(!picker)return;
    const all=[...picker.querySelectorAll('input[name="equipment"]')];
    const selected=all.filter(input=>input.checked).length;
    const count=picker.querySelector('[data-equipment-count]');
    if(count)count.textContent=`${selected} ${selected===1?'item':'items'} selected`;
    const search=String(picker.querySelector('[data-equipment-search]')?.value||'').trim().toLocaleLowerCase();
    const onlySelected=picker.querySelector('[data-equipment-selected-only]')?.getAttribute('aria-pressed')==='true';
    const filtering=!!search||onlySelected;
    const nav=picker.querySelector('[data-equipment-nav]');
    if(nav)nav.hidden=filtering;
    const browser=picker.querySelector('.fleet-equipment-browser'),body=picker.querySelector('.fleet-equipment-body');
    if(browser){browser.style.display=filtering?'block':'';browser.style.gridTemplateColumns=filtering?'minmax(0,1fr)':'';}
    if(body){body.style.width=filtering?'100%':'';body.style.minWidth=filtering?'0':'';body.style.boxSizing=filtering?'border-box':'';}
    picker.classList.toggle('is-filtering',filtering);
    const active=Number(picker.dataset.activeCategory||0);
    let matches=0;
    for(const group of picker.querySelectorAll('[data-equipment-group]')){
      const index=Number(group.dataset.equipmentGroup),inputs=[...group.querySelectorAll('input[name="equipment"]')];
      const total=inputs.filter(input=>input.checked).length;
      const tab=picker.querySelector(`[data-equipment-category="${index}"]`);
      if(tab){tab.setAttribute('aria-pressed',String(index===active));const badge=tab.querySelector('[data-equipment-category-count]');if(badge)badge.textContent=total?String(total):'';}
      let groupMatches=0;
      for(const input of inputs){
        const option=input.closest('label'),label=option?.querySelector('span')?.textContent?.toLocaleLowerCase()||'';
        const show=(!onlySelected||input.checked)&&(!search||label.includes(search));
        if(option)option.hidden=!show;
        if(show)groupMatches++;
      }
      if(filtering)matches+=groupMatches;
      group.hidden=filtering?!groupMatches:index!==active;
    }
    const empty=picker.querySelector('[data-equipment-empty]');
    if(empty){empty.hidden=!filtering||matches>0;empty.textContent=onlySelected&&!selected?'Nothing selected yet. Choose a category to get started.':'No matching equipment found. Try another search.';}
  }
  const ownerStepNames=['Boat & location','Price & skipper','Photos & details'];
  const ownerStepStorageKey=()=>`gbb-owner-step:${location.hash.split('?')[0]}:${new URLSearchParams(location.hash.split('?')[1]||'').get('edit')||'new'}`;
  function restoredOwnerBoatStep(){try{return Math.min(3,Math.max(1,Number(sessionStorage.getItem(ownerStepStorageKey()))||1))}catch{return 1}}
  function showOwnerBoatStep(form,next){
    if(!form?.querySelectorAll)return;
    const step=Math.min(3,Math.max(1,Number(next)||1));
    form.dataset.editorStep=String(step);
    try{sessionStorage.setItem(ownerStepStorageKey(),String(step))}catch{}
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
  function ownerFleet(boats,bookings,filter='all',layout='grid'){
    const live=boats.filter(b=>b.published).length,drafts=boats.length-live,pending=bookings.filter(r=>r.status==='pending_owner').length;
    const visible=boats.filter(b=>filter==='published'?b.published:filter==='drafts'?!b.published:true);
    const filters=[['all','All boats',boats.length],['published','Published',live],['drafts','Drafts',drafts]];
    const selectedLayout=['grid','list'].includes(layout)?layout:'grid';
    const fleetUrl=(nextFilter,nextLayout)=>'#/owner'+(new URLSearchParams([...(nextFilter==='all'?[]:[['filter',nextFilter]]),...(nextLayout==='grid'?[]:[['layout',nextLayout]])])).toString().replace(/^/,'?').replace(/\?$/,'');
    const layouts=[['grid','Grid','▦'],['list','List','☰']];
    return `<div class="fleet-home"><div class="fleet-hero"><div><span class="member-eyebrow">YOUR FLEET · GET BY BOAT</span><h2>My Boats</h2><p>Manage listings, pricing and availability in one place.</p></div><a class="btn fleet-primary" href="#/owner?edit=new">${icon('plus')} Add a boat</a></div><div class="fleet-stat-grid"><div><span>Total listings</span><strong>${boats.length}</strong><small>Boats in your account</small></div><div><span>Published</span><strong>${live}</strong><small>Visible to customers</small></div><div><span>Drafts</span><strong>${drafts}</strong><small>Not yet public</small></div><a href="#/owner?view=requests"><span>Requests to answer</span><strong>${pending}</strong><small>${pending?'Review booking requests':'All caught up'} ${icon('arrow')}</small></a></div><div class="fleet-list-head"><div><h2>Your listings</h2><p>${visible.length} ${visible.length===1?'boat':'boats'} shown</p></div><div class="fleet-filters" aria-label="Filter listings">${filters.map(([key,label,count])=>`<a href="${fleetUrl(key,selectedLayout)}" ${filter===key?'aria-current="true"':''}>${label} <span>${count}</span></a>`).join('')}</div><div class="fleet-layout-switch" role="group" aria-label="Listing display">${layouts.map(([key,label,symbol])=>`<a href="${fleetUrl(filter,key)}" class="fleet-layout-option" ${selectedLayout===key?'aria-current="true"':''} title="${label} view"><span aria-hidden="true">${symbol}</span><span>${label}</span></a>`).join('')}</div></div>${visible.length?`<div class="fleet-card-grid fleet-layout-${selectedLayout}">${visible.map(b=>{const relevant=bookings.filter(r=>r.boat_id===b.id&&r.status==='pending_owner').length;return `<article class="fleet-card"><div class="fleet-card-photo">${picture(b)}<span class="fleet-status ${b.published?'is-live':'is-draft'}">${b.published?'● Published':'○ Draft'}</span></div><div class="fleet-card-body"><div class="fleet-card-head"><h3>${esc(b.name)}</h3><span class="fleet-daily">${money(b.price)} <small>/ day</small></span></div><p class="fleet-location">${icon('pin')} ${esc(b.location)}, ${esc(b.country)}</p><div class="fleet-specs"><span>${icon('ship')} ${esc(b.type)}</span><span>${icon('user')} ${b.guests} guests</span></div><p class="fleet-modes">${captainCapIcon} <span>${esc(ownerSkipperOption(b))}</span></p>${relevant?`<p class="fleet-attention">${relevant} ${relevant===1?'booking request':'booking requests'} awaiting a reply</p>`:''}<div class="fleet-card-actions"><a class="btn" href="#/owner?edit=${esc(b.id)}">Edit listing</a><a class="fleet-link" href="#/owner?view=calendar&boat=${esc(b.id)}">${icon('calendar')} Calendar</a><a class="fleet-link" href="#/listing/${esc(b.id)}">${icon('arrow')} Preview</a></div></div></article>`}).join('')}</div>`:`<div class="fleet-empty"><span>${icon('ship')}</span><h3>${boats.length?'No boats match this filter':'Your first listing starts here'}</h3><p>${boats.length?'Choose another filter to see your boats.':'Add your boat, set your price and rental options, then prepare it for publication.'}</p><a class="btn" href="${boats.length?'#/owner':'#/owner?edit=new'}">${boats.length?'Show all boats':'Add your first boat'}</a></div>`}</div>`;
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
    return `<div class="fleet-editor-page"><div class="fleet-editor-header"><div><a class="fleet-back" href="#/owner">← Back to My Boats</a><span class="member-eyebrow">BOAT SETUP</span><h2>${b.id?esc(b.name):'List your boat'}</h2><p>Everything guests need to know, organised into four quick steps.</p><span class="fleet-editor-state ${b.published?'published':'draft'}">${b.published?'● Published listing':'○ Draft listing'}</span></div>${b.id?`<a class="btn live-secondary" href="#/owner?view=calendar&boat=${esc(b.id)}">${icon('calendar')} Manage calendar</a>`:''}</div><form data-live-form="boat" data-id="${esc(b.id||'')}" class="fleet-editor-form live-form" novalidate><nav class="fleet-editor-navigation" aria-label="Listing setup steps"><button type="button" data-live="boat-step" data-step="1" aria-current="step"><b>1</b> Boat & location</button><button type="button" data-live="boat-step" data-step="2"><b>2</b> Price & skipper</button><button type="button" data-live="boat-step" data-step="3"><b>3</b> Photos & details</button><button type="button" data-live="boat-step" data-step="4"><b>4</b> Publish</button></nav><div class="fleet-editor-fields"><section class="profile-panel fleet-editor-section" id="boat-basics" data-editor-step="1"><div class="fleet-editor-section-heading"><span>01</span><div><h3>Boat details</h3><p>Help customers find the right boat.</p></div></div>${field('Boat name','name','text',b.name||'','required maxlength="120" placeholder="e.g. Quicksilver 755 Sundeck"')}<div class="live-columns"><label>Boat type<select name="type">${['Motorboat','RIB','Sailboat','Catamaran','Yacht','Jetski'].map(t=>`<option ${t===b.type?'selected':''}>${t}</option>`).join('')}</select></label></div><div class="live-columns">${field('Country','country','text',b.country||'','required maxlength="80"')}${field('Marina / location','location','text',b.location||'','required maxlength="160"')}</div></section><section class="profile-panel fleet-editor-section" id="boat-rental" data-editor-step="2" hidden><div class="fleet-editor-section-heading"><span>02</span><div><h3>Pricing & skipper</h3><p>Be clear about what guests pay and who drives the boat.</p></div></div>${field('Boat price per day (€)','price','number',b.price||'','required min="1" max="100000" step="0.01"')}<fieldset class="fleet-rental-modes"><legend>Available rental options</legend><label class="live-check"><input type="checkbox" name="with_skipper" ${b.with_skipper?'checked':''}> <span><strong>Rent with skipper</strong><small>A qualified skipper operates the boat. Guests need no driving licence verification.</small></span></label><label class="live-check"><input type="checkbox" name="without_skipper" ${b.without_skipper!==false?'checked':''}> <span><strong>Rent without skipper</strong><small>Guests must have verified identification and boat licence.</small></span></label></fieldset><div class="fleet-skipper-fee" data-skipper-fee-wrapper>${field('Additional skipper fee per day (€)','skipper_fee_per_day','number',b.skipper_fee_per_day||0,`min="0" max="10000" step="0.01" ${both?'required':''} ${both?'':'disabled'}`)}<p data-skipper-fee-note class="member-note">${both?'The skipper fee is included in the guest’s online checkout after owner confirmation. Get By Boat takes no commission on the skipper fee.':'If this boat is rented only with a skipper, the skipper is included in the boat price. An extra fee is not charged.'}</p></div><p class="fleet-editor-hint">Check-in is at 09:00 and check-out at 19:00 for daily rentals.</p></section><section class="profile-panel fleet-editor-section" id="boat-description" data-editor-step="3" hidden><div class="fleet-editor-section-heading"><span>03</span><div><h3>Description & photos</h3><p>Show guests why they should choose your boat.</p></div></div><label>Boat description<textarea name="description" maxlength="10000" rows="6" placeholder="Tell guests about the boat, equipment, suggested routes and what is included.">${esc(b.description||'')}</textarea></label>${(()=>{const photos=[...new Set([...(Array.isArray(b.photo_urls)?b.photo_urls:[]),...(b.photo_url?[b.photo_url]:[])])].filter(photo).slice(0,15);return photos.length?`<div class="fleet-photo-gallery" aria-label="Drag photos to change their order">${photos.map((url,i)=>`<div class="fleet-photo-card" data-photo-url="${esc(url)}"><img src="${esc(photo(url))}" alt="Boat photo ${i+1}" loading="lazy" draggable="false" aria-label="Drag this photo to reorder"><span class="fleet-photo-position">${i===0?'Cover photo':'Photo '+(i+1)}</span><div class="fleet-photo-actions"><span class="fleet-drag-handle" title="Drag the photo to reorder">⠿ Drag photo</span><button type="button" class="fleet-photo-move" data-photo-move="-1" aria-label="Move photo left">‹</button><button type="button" class="fleet-photo-move" data-photo-move="1" aria-label="Move photo right">›</button><button type="button" class="fleet-photo-remove-button" data-photo-delete aria-label="Remove photo ${i+1}">Remove</button></div></div>`).join('')}</div><p class="member-note" data-photo-summary>${photos.length} / 15 photos saved. Drag photos to reorder them. Changes are applied when you save.</p><div class="fleet-photo-undo" data-photo-undo hidden><span>Photo removed from this listing.</span><button type="button" data-photo-restore>Undo</button></div>`:''})()}<label class="fleet-photo-upload"><span class="fleet-upload-symbol">＋</span><span class="fleet-upload-details"><strong>Add more photos</strong><small>Click to browse or drop images here</small><em data-photo-file-count>JPG, PNG or WebP · Up to 5 MB each</em></span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple></label><div class="fleet-photo-pending" data-pending-photo-preview aria-live="polite" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-top:16px"></div><p class="member-note fleet-photo-upload-hint">Up to 15 photos total. The first image is your cover photo.</p></section><section class="profile-panel fleet-editor-section" id="boat-publishing" data-editor-step="4" hidden><div class="fleet-editor-section-heading"><span>04</span><div><h3>Publication status</h3><p>Choose whether customers can discover this boat.</p></div></div><label class="live-check fleet-publish-toggle"><input type="checkbox" name="published" ${b.published?'checked':''} ${!canPublish&&!b.published?'disabled':''}> <span><strong>Publish this listing</strong><small>Uncheck to save privately as a draft or pause new bookings.</small></span></label>${!canPublish?`<p class="verification-warning">${b.published?'This existing listing can stay live; republishing requires verification.':'You can save a draft now. Publishing requires approved owner verification.'} <a href="#/account?tab=business">Complete business verification</a>.</p>`:''}<p class="member-note">All booking requests require your acceptance. Existing bookings are not cancelled when you unpublish a boat.</p></section><div class="fleet-editor-save"><span data-editor-progress>Step 1 of 4 · Boat & location</span><div class="fleet-editor-actions"><button class="fleet-step-secondary" type="button" data-live="boat-prev" hidden>Back</button><button class="fleet-step-secondary" type="button" data-live="boat-next">Next step →</button><button class="btn" type="submit">${b.id?'Save changes':'Save boat'}</button></div><p data-feedback role="status"></p></div></div></form></div>`;
  }
  function boatForm(b={}){
    const s=b.specifications||{},hasSpecs=Object.entries(s).some(([name,value])=>!['equipment','pets_allowed','cabins','berths'].includes(name)&&value!==''&&value!==null&&value!==undefined);
    const both=!!b.with_skipper&&b.without_skipper!==false;
    const types=[['','Not specified'],['outboard','Outboard'],['inboard','Inboard'],['electric','Electric'],['none','No engine'],['other','Other']];
    const insuranceTypes=[['not_specified','Not specified'],['none','Not insured'],['third_party','Third-party insurance'],['comprehensive','Fully comprehensive']];
    const optionalSelect=(name,label,options,value)=>`<label>${esc(label)}<select name="${name}">${options.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
    const number=(label,name,value,max,step='1')=>field(label,name,'number',value??'',`min="0" max="${max}" step="${step}" placeholder="Optional"`);
    const technical=`<details class="fleet-optional-panel" open><summary><span>${icon('ship')} Technical specifications</span><small>Capacity, engine & dimensions</small></summary><div class="fleet-optional-content"><p class="member-note">Complete the main boat specifications. Only boat width and draft are optional in this section.</p><div class="live-columns">${`<label>Engine type<select name="spec_engine_type" required>${types.map(([id,text])=>`<option value="${esc(id)}" ${id===(s.engine_type||'')?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`}${field('Total engine horsepower (hp)','spec_engine_hp','number',s.engine_hp??'','required min="0" max="50000" step="1"')}</div><div class="live-columns">${field('Boat length (m)','spec_length_m','number',s.length_m??'','required min="0.01" max="200" step="0.01"')}${number('Boat width (m)','spec_width_m',s.width_m,100,'0.01')}</div><div class="live-columns">${number('Draft (m)','spec_draft_m',s.draft_m,50,'0.01')}${field('Year built','spec_build_year','number',s.build_year??'','required min="1850" max="2100" step="1"')}</div><div class="live-columns">${field('Tank capacity (L)','spec_tank_capacity_l','number',s.tank_capacity_l??'','required min="0" max="50000" step="1"')}${field('Fuel consumption (L/h)','spec_fuel_lph','number',s.fuel_lph??'','required min="0" max="10000" step="0.1"')}</div><div class="live-columns">${number('Top speed (knots)','spec_speed_knots',s.speed_knots,200,'0.1')}${number('Crew members (if included)','spec_crew',s.crew,100)}</div><div class="live-columns">${field('Number of berths','spec_berths','number',Number(b.specifications?.berths)>0?b.specifications.berths:'','min="0" max="100" step="1" placeholder="Optional"')}${field('Number of cabins','spec_cabins','number',Number(b.specifications?.cabins)>0?b.specifications.cabins:'','min="0" max="100" step="1" placeholder="Optional"')}${field('Number of people','guests','number',b.guests??'','required min="1" max="100" step="1"')}</div></div></details>`;
    const insurance=`<details class="fleet-optional-panel" open><summary><span>${icon('shield')} Insurance & security deposit</span><small>Optional · coverage and refundable deposit</small></summary><div class="fleet-optional-content"><p class="member-note">Choose the insurance coverage and refundable deposit applicable to this boat.</p><div class="live-columns fleet-insurance-fields">${optionalSelect('insurance_type','Insurance coverage',insuranceTypes,b.insurance_type||'not_specified')}${number('Refundable security deposit (€)','security_deposit',b.security_deposit??0,100000,'0.01')}</div></div></details>`;
    const selectedEquipment=new Set(Array.isArray(s.equipment)?s.equipment:[]);
    const equipmentCount=[...selectedEquipment].filter(id=>allowedEquipment.has(id)).length;
    const firstEquipmentGroup=Math.max(0,equipmentCategories.findIndex(([,options])=>options.some(([id])=>selectedEquipment.has(id))));
    const equipment=`<section class="fleet-equipment-panel" data-equipment-picker data-active-category="${firstEquipmentGroup}" aria-labelledby="equipment-picker-title"><div class="fleet-equipment-heading"><div><span class="fleet-equipment-eyebrow">MAKE YOUR LISTING STAND OUT</span><h4 id="equipment-picker-title">Equipment &amp; amenities</h4><p>Choose what is on board. Your selections appear in the listing.</p></div><span class="fleet-equipment-count" data-equipment-count aria-live="polite">${equipmentCount} ${equipmentCount===1?'item':'items'} selected</span></div><div class="fleet-equipment-toolbar"><label class="fleet-equipment-search"><span>Find equipment</span><input type="search" data-equipment-search placeholder="Search Wi-Fi, GPS, paddle board…" autocomplete="off"></label><button class="fleet-equipment-filter" type="button" data-equipment-selected-only aria-pressed="false">${icon('check')} Show selected only</button></div><div class="fleet-equipment-browser"><div class="fleet-equipment-nav" data-equipment-nav role="group" aria-label="Equipment categories">${equipmentCategories.map(([group,options],i)=>{const count=options.filter(([id])=>selectedEquipment.has(id)).length;return `<button type="button" class="fleet-equipment-tab" data-equipment-category="${i}" aria-pressed="${i===firstEquipmentGroup}">${equipmentIcon(options[0][0])}<span class="fleet-equipment-tab-name">${esc(group)}</span><span data-equipment-category-count>${count||''}</span></button>`;}).join('')}</div><div class="fleet-equipment-body">${equipmentCategories.map(([group,options],i)=>`<section class="fleet-equipment-group" data-equipment-group="${i}" ${i===firstEquipmentGroup?'':'hidden'}><h5>${equipmentIcon(options[0][0])}${esc(group)}</h5><div class="fleet-equipment-options">${options.map(([id,label])=>`<label class="fleet-equipment-option">${equipmentIcon(id)}<span>${esc(label)}</span><input type="checkbox" name="equipment" value="${esc(id)}" ${selectedEquipment.has(id)?'checked':''}></label>`).join('')}</div></section>`).join('')}<p class="fleet-equipment-no-results" data-equipment-empty hidden>No matching equipment found. Try another search.</p></div></div><p class="fleet-equipment-footnote">All selected equipment will appear in the public boat listing after you save.</p></section>`;
    const closing='</section><section class="profile-panel fleet-editor-section" id="boat-publishing"';
    const canPublish=ownerVerificationState()==='approved',willPublish=canPublish||!!b.published;
    const countryField=field('Country','country','text',b.country||'','required maxlength="80"');
    const countries=`<label>Country<input name="country" type="text" value="${esc(b.country==='United States'?'USA':b.country||'')}" required maxlength="80" list="boat-countries" autocomplete="off" placeholder="Start typing a country in English"><datalist id="boat-countries">${countryLabels.map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist></label>`;
    const pickup=String(b.pickup_location||b.location||'');
    const pickupCoordinates=boatPickupCoordinates(b);
    const pickupFields=`<div class="fleet-pickup"><h4>Where will guests pick up the boat?</h4>${field('Pickup point / meeting address','pickup_location','text',pickup,'required maxlength="240" placeholder="e.g. Marina Hramina, pier A"')}<div class="fleet-pickup-actions"><button class="btn live-secondary" type="button" data-pickup-search>Find address on map</button></div><p class="member-note">Drag the pin or click the exact marina. Guests only see your city until their booking is paid and confirmed.</p><div class="fleet-pickup-map" data-pickup-map aria-label="Interactive pickup map with a draggable pin"></div><p class="fleet-pickup-status" data-pickup-status role="status"></p><input type="hidden" name="pickup_latitude" value="${esc(pickupCoordinates?pickupCoordinates[0]:'')}"><input type="hidden" name="pickup_longitude" value="${esc(pickupCoordinates?pickupCoordinates[1]:'')}"></div>`;
    return positionOwnerRentalModes(boatFormBase(b)
      .replace('organised into four quick steps','organised into three quick steps')
      .replace('<button type="button" data-live="boat-step" data-step="4"><b>4</b> Publish</button>','')
      .replace(countryField,countries)
      .replace('Marina / location','Town / city (public)')
      .replace('</div></section><section class="profile-panel fleet-editor-section" id="boat-rental"',`</div>${pickupFields}</section><section class="profile-panel fleet-editor-section" id="boat-rental"`)
      .replace('Maximum guests','Maximum Passengers')
      .replace('Boat price per day (€)','Your payout per day (€)')
      .replace('<fieldset class="fleet-rental-modes">',`<p class="fleet-guest-rate" data-guest-price-preview>Guest price: <strong>${money(guestDailyRate(b.price||0))} for 1 day</strong> · fees included.</p><fieldset class="fleet-rental-modes">`)
      .replace('<p class="fleet-editor-hint">Check-in is at 09:00 and check-out at 19:00 for daily rentals.</p>',`<div class="live-columns">${field('Check-in time','check_in_time','time',String(b.check_in_time||'09:00').slice(0,5),'required step="900"')}${field('Check-out time','check_out_time','time',String(b.check_out_time||'19:00').slice(0,5),'required step="900"')}</div><div class="fleet-boat-rules"><h4>Boat rules</h4><div class="fleet-boat-rules-grid">${optionalSelect('licence_required','Boat licence required',[['true','Yes'],['false','No']],b.licence_required===false?'false':'true')}${optionalSelect('pets_allowed','Pets allowed',[['false','No'],['true','Yes']],s.pets_allowed===true?'true':'false')}${field('Minimum rental age (years)','minimum_rental_age','number',b.minimum_rental_age||18,'required min="18" max="100"')}</div></div>`)
      .replace('</fieldset><div class="fleet-skipper-fee"',`<button type="button" class="fleet-offer-both" data-rental-both>✓ Offer both rental options</button><p class="fleet-rental-summary" data-rental-mode-summary></p></fieldset><div class="fleet-skipper-fee"`)
      .replace('Additional skipper fee per day (€)','Skipper price per day (€)')
      .replace(`min="0" max="10000" step="0.01" ${both?'required':''} ${both?'':'disabled'}`,`min="${both?'0.01':'0'}" max="10000" step="0.01" ${both?'required':''} ${both?'':'disabled'}`)
      .replace('data-skipper-fee-wrapper>','data-skipper-fee-wrapper '+(both?'':'hidden')+'>')
      .replace(closing,technical+insurance+equipment+closing)
      .replace(/<section class="profile-panel fleet-editor-section" id="boat-publishing"[\s\S]*?<\/section>/,'')
      .replace('<div class="fleet-editor-save">',`<input type="hidden" name="published" value="${willPublish?'on':''}"><div class="fleet-editor-save">`)
      .replace('Step 1 of 4 · Boat & location','Step 1 of 3 · Boat & location')
      .replace(/<button class="btn" type="submit">(?:Save changes|Save boat)<\/button>/,`<button class="btn" type="submit">${willPublish?'Publish':'Save draft'}</button>`)
      .replace('<p data-feedback role="status"></p></div></div></form>',`${!willPublish?'<p class="verification-warning">To publish, complete your <a href="#/account?tab=business">owner verification</a>. Your boat will be saved as a draft until approval.</p>':''}<p data-feedback role="status"></p></div></div></form>`));
  }
  function positionOwnerRentalModes(markup){
    const start=markup.indexOf('<fieldset class="fleet-rental-modes">');
    const end=start<0?-1:markup.indexOf('</fieldset>',start);
    const checkInAnchor='<div class="live-columns"><label>Check-in time<input name="check_in_time"';
    if(start<0||end<0||!markup.includes(checkInAnchor))return markup;
    const choices=`<fieldset class="fleet-rental-modes fleet-skipper-modes"><legend>Skipper availability</legend><label class="fleet-mode-option"><input type="radio" name="skipper_mode" value="self" ${!markup.includes('name="with_skipper" checked')&&markup.includes('name="without_skipper" checked')?'checked':''}><span class="fleet-mode-copy"><span class="fleet-mode-symbol">${icon('ship')}</span><strong>Self-drive only</strong><small>Guests captain the boat themselves, with a licence where required.</small></span></label><label class="fleet-mode-option"><input type="radio" name="skipper_mode" value="optional" ${markup.includes('name="with_skipper" checked')&&markup.includes('name="without_skipper" checked')?'checked':''}><span class="fleet-mode-copy"><span class="fleet-mode-symbol">${icon('users')}</span><strong>Skipper optional</strong><small>Guests choose a skipper. The extra fee is paid at check-in.</small></span></label><label class="fleet-mode-option"><input type="radio" name="skipper_mode" value="included" ${markup.includes('name="with_skipper" checked')&&!markup.includes('name="without_skipper" checked')?'checked':''}><span class="fleet-mode-copy"><span class="fleet-mode-symbol">${icon('shield')}</span><strong>Skipper included</strong><small>A professional skipper comes included in your boat price.</small></span></label><input type="checkbox" name="with_skipper" ${markup.includes('name="with_skipper" checked')?'checked':''} hidden><input type="checkbox" name="without_skipper" ${markup.includes('name="without_skipper" checked')?'checked':''} hidden></fieldset>`;
    const remaining=markup.slice(0,start)+markup.slice(end+'</fieldset>'.length);
    
    const feeStart=remaining.indexOf('<div class="fleet-skipper-fee"'),feeEnd=feeStart<0?-1:remaining.indexOf('</div>',feeStart)+6;
    const feeMarkup=feeStart>=0&&feeEnd>feeStart?remaining.slice(feeStart,feeEnd):'';
    const clean=feeMarkup?remaining.slice(0,feeStart)+remaining.slice(feeEnd):remaining;
    const callout=`<div class="fleet-rental-onboarding"><div class="fleet-rental-onboarding-heading"><h4>How can guests rent your boat?</h4><p>Choose the experience you offer. Guests will see this on your listing.</p></div>${choices}${feeMarkup}</div>`;
    const cleanInsert=clean.indexOf(checkInAnchor);
    return clean.slice(0,cleanInsert)+callout+clean.slice(cleanInsert);
    
  }
  function ownerReviewForm(booking,existing){
    if(booking.status!=='confirmed'||booking.end_date>=today())return '';
    if(existing)return `<div class="booking-owner-review is-submitted"><strong>Your owner review</strong><p>${stars(existing.rating)} ${existing.comment?esc(existing.comment):'Thank you for your rating!'}</p></div>`;
    return `<form class="booking-owner-review live-form" data-live-form="guest-owner-review" data-id="${esc(booking.id)}" data-boat="${esc(booking.boat_id)}" data-owner="${esc(booking.boats?.owner_id||'')}"><h4>How was your experience with the owner?</h4><p>Leave a rating after your completed rental.</p><fieldset class="owner-star-picker"><legend>Rate the owner from 1 to 5 stars</legend>${[5,4,3,2,1].map(i=>`<label title="${i} ${i===1?'star':'stars'}"><input type="radio" name="rating" value="${i}" required><span aria-hidden="true">★</span><span class="sr-only">${i} out of 5 stars</span></label>`).join('')}</fieldset><label class="booking-review-comment">Your review (optional)<textarea name="comment" rows="3" maxlength="1500" placeholder="What did you enjoy about your experience?"></textarea></label><button class="btn" type="submit">Post review</button><p data-feedback role="status"></p></form>`;
  }
  function customerBookings(rows,reviews=[]){
    if(!rows.length)return '<div class="booking-empty"><h3>No bookings yet</h3><p>Explore boats and send your first booking request.</p><a class="btn live-secondary" href="#/boats">Explore boats</a></div>';
    return '<div class="customer-bookings-list">'+rows.map(r=>{
      const review=ownerReviewForm(r,reviews.find(item=>item.booking_id===r.id));
      const badge=['awaiting_payment','confirmed'].includes(r.status)?'is-approved':r.status==='declined'?'is-declined':'';
      const dates=esc(euroRange(r.start_date,r.end_date));
      const checkIn=esc(boatClock(r.boats?.check_in_time,'09:00'));
      const checkOut=esc(boatClock(r.boats?.check_out_time,'18:00'));
      const skipperNote=r.with_skipper&&Number(r.skipper_fee_total)>0?'Skipper fee '+money(r.skipper_fee_total)+' included in total':r.with_skipper?'Skipper included in boat price':'Self-drive';
      return `<article class="customer-booking-card">
        <div class="customer-booking-heading"><div><span class="customer-booking-eyebrow">BOAT RESERVATION</span><h3>${esc(r.boats?.name||'Boat reservation')}</h3></div><span class="live-status ${badge}">${esc(status(r.status))}</span></div>
        <div class="customer-booking-details"><div class="customer-booking-detail"><span>${icon('calendar')} RENTAL DATES</span><strong>${dates}</strong></div><div class="customer-booking-detail"><span>${icon('clock')} CHECK-IN / CHECK-OUT</span><strong>${checkIn} – ${checkOut}</strong></div><div class="customer-booking-detail"><span>${icon('user')} PASSENGERS</span><strong>${Number(r.guests)||1}</strong></div><div class="customer-booking-detail"><span>${icon('ship')} RENTAL OPTION</span><strong>${r.with_skipper?'With skipper':'Without skipper'}</strong></div></div>
        <div class="customer-booking-bottom"><div class="customer-booking-price"><span>TOTAL BOAT PRICE</span><strong>${money(r.total)}</strong><small>${skipperNote}</small></div><div class="customer-booking-actions"><a class="btn live-secondary" href="#/messages?booking=${esc(r.id)}">${icon('message')} Message owner</a>${['pending_owner','awaiting_payment'].includes(r.status)?btn('Cancel request','cancel',r.id):''}</div></div>
        ${r.status==='awaiting_payment'?'<p class="customer-booking-notice">Your dates are held. Online payment is not available yet. This is not a paid, confirmed booking.</p>':''}
        <div class="customer-booking-id">Request ID: ${esc(r.id)}</div>${review}
      </article>`;
    }).join('')+'</div>';
  }
  function requests(rows,owner=false,reviews=[]){return rows.length?rows.map(r=>{
    const ownReview=!owner?ownerReviewForm(r,reviews.find(review=>review.booking_id===r.id)):'';
    return `<article class="live-card"><span class="live-status ${['awaiting_payment','confirmed'].includes(r.status)?'is-approved':r.status==='declined'?'is-declined':''}">${esc(status(r.status))}</span><h3>${esc(r.boats?.name||'Boat reservation')}</h3><p>${esc(euroRange(r.start_date,r.end_date))} · ${esc(boatClock(r.boats?.check_in_time,'09:00'))} check-in · ${esc(boatClock(r.boats?.check_out_time,'19:00'))} check-out · ${r.guests} passengers</p><p><strong>${r.with_skipper?'Rent with skipper':'Rent without skipper'}</strong></p>${owner?`<p>Guest: ${esc(r.customer_name)}</p><p>Owner charter: ${money(r.charter_price)} · Get By Boat commission: ${money(Math.max(0,Number(r.service_fee)-(Number(r.processing_fee)||0)))} · Processing allowance: ${money(Number(r.processing_fee)||0)} · Total service fee: ${money(r.service_fee)} · Guest total: <strong>${money(r.total)}</strong></p>`:`<p><strong>Total boat price: ${money(r.total)}</strong></p>`}${r.with_skipper&&Number(r.skipper_fee_total)>0?`<p class="fleet-quote-extra">Skipper: <strong>${money(r.skipper_fee_total)}</strong> included in the total paid through Get By Boat.</p>`:r.with_skipper?`<p class="fleet-quote-extra">Skipper included in the boat price.</p>`:''}<small>Request ${esc(r.id)}</small><div class="live-actions"><a class="btn live-secondary" href="#/messages?booking=${esc(r.id)}">${icon('message')} ${owner?'Message guest':'Message owner'}</a>${owner&&r.status==='pending_owner'?btn('Accept request','accept',r.id)+btn('Decline','decline',r.id):''}${!owner&&['pending_owner','awaiting_payment'].includes(r.status)?btn('Cancel request','cancel',r.id):''}</div>${r.status==='awaiting_payment'?'<p>Your dates are held. Online payment is not available yet. This is not a paid, confirmed booking.</p>':''}${ownReview}</article>`;
  }).join(''):'<div class="live-card"><p>No booking requests yet.</p></div>'}
  function ownerRequestsWorkspace(rows){
    const pending=rows.filter(r=>r.status==='pending_owner');
    const active=rows.filter(r=>['awaiting_payment','confirmed'].includes(r.status));
    const closed=rows.filter(r=>['declined','cancelled'].includes(r.status));
    const card=r=>`<article class="owner-request-card ${r.status==='pending_owner'?'is-pending':['awaiting_payment','confirmed'].includes(r.status)?'is-accepted':r.status==='declined'?'is-declined':r.status==='cancelled'?'is-cancelled':''}"><div class="owner-request-card-top"><div class="owner-request-guest-avatar" aria-hidden="true">${esc((r.customer_name||'G').trim().charAt(0).toUpperCase())}</div><div class="owner-request-identity"><span class="owner-request-eyebrow">BOOKING REQUEST</span><h3>${esc(r.customer_name||'Guest')}</h3><p>${esc(r.boats?.name||'Boat reservation')}</p></div><span class="live-status ${['awaiting_payment','confirmed'].includes(r.status)?'is-approved':r.status==='declined'?'is-declined':''}">${esc(status(r.status))}</span></div><div class="owner-request-info"><div><span>${icon('calendar')} RENTAL DATES</span><strong>${esc(bookingLongDate(r.start_date))}${r.start_date!==r.end_date?` – ${esc(bookingLongDate(r.end_date))}`:''}</strong></div><div><span>${icon('clock')} CHECK-IN / OUT</span><strong>${esc(boatClock(r.boats?.check_in_time,'09:00'))} – ${esc(boatClock(r.boats?.check_out_time,'18:00'))}</strong></div><div><span>${icon('user')} GUESTS</span><strong>${esc(r.guests)} ${Number(r.guests)===1?'person':'people'}</strong></div><div><span>${icon('ship')} RENTAL OPTION</span><strong>${r.with_skipper?'With skipper':'Without skipper'}</strong></div></div><div class="owner-request-footer"><div class="owner-request-price"><span>YOUR PAYOUT</span><strong>${money(r.charter_price)}</strong></div><div class="owner-request-actions"><a class="btn live-secondary" href="#/messages?booking=${esc(r.id)}">${icon('message')} Open conversation</a>${r.status==='pending_owner'?btn('Accept request','accept',r.id)+btn('Decline','decline',r.id):''}</div></div>${r.status==='awaiting_payment'?'<div class="owner-request-note">Awaiting payment · Online payment is not available yet.</div>':''}</article>`;
    const group=(title,subtitle,list)=>list.length?`<section class="owner-requests-group"><div class="owner-requests-group-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><span>${list.length}</span></div><div class="owner-requests-list">${list.map(card).join('')}</div></section>`:'';
    return `<div class="owner-requests-workspace"><div class="owner-requests-intro"><div><span class="member-page-kicker">YOUR BOOKINGS</span><h2>Stay on top of every request.</h2><p>Review the trip details, respond to guests and keep track of your bookings.</p></div>${btn('Refresh','refresh')}</div><div class="owner-requests-summary"><div><span>All requests</span><strong>${rows.length}</strong></div><div><span>Awaiting your response</span><strong>${pending.length}</strong></div><div><span>Accepted / upcoming</span><strong>${active.length}</strong></div></div>${group('Needs your attention','Guests waiting for your response.',pending)}${group('Accepted requests','Requests that have moved forward.',active)}${group('Past & closed','Declined or cancelled requests.',closed)}${rows.length?'':'<div class="owner-requests-empty">No booking requests yet. New guest requests will appear here.</div>'}</div>`;
  }
  const bookingLongDate=value=>{const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);if(!match)return '';const day=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));return Number.isNaN(day.getTime())?'':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(day);};
  async function messagesPage(requestedId){
    // Booking RLS filters this to bookings in which the signed-in user participates.
    const rows=check(await client.from('bookings').select('id,customer_id,boat_id,customer_name,start_date,end_date,with_skipper,status,created_at,charter_price,total,service_fee,processing_fee,skipper_fee_total,boats(name,owner_id,check_in_time,check_out_time)').order('created_at',{ascending:false}).limit(100));
    if(!rows.length)return page('Messages',`<div class="member-empty"><h2>No conversations yet</h2><p>A private conversation begins as soon as a guest sends a booking request.</p><a class="btn" href="${profile?.account_type==='owner'?'#/owner':'#/boats'}">${profile?.account_type==='owner'?'Manage my boats':'Explore boats'}</a></div>`);
    const selected=rows.find(r=>r.id===requestedId)||rows[0];
    const messages=check(await client.from('booking_messages').select('id,booking_id,sender_id,content,created_at,read_at').eq('booking_id',selected.id).order('created_at',{ascending:true}).limit(200));
    const offers=check(await client.from('booking_offers').select('id,booking_id,owner_id,charter_price,extras_on_site,expires_at,status,created_at,accepted_at').eq('booking_id',selected.id).order('created_at',{ascending:false}).limit(20));
    const currentOffer=offers[0]||null,offerExpired=!!currentOffer&&currentOffer.status==='sent'&&new Date(currentOffer.expires_at)<=new Date(),isOwner=selected.boats?.owner_id===session.user.id;
    const editable=['pending_owner','awaiting_payment','confirmed'].includes(selected.status);
    const mine=session.user.id;
    // Only recipients can mark messages read; an insert or edit never changes sender/content.
    if(messages.some(m=>m.sender_id!==mine&&!m.read_at))client.from('booking_messages').update({read_at:new Date().toISOString()}).eq('booking_id',selected.id).neq('sender_id',mine).is('read_at',null).then(()=>{});
    const conversations=rows.map(r=>`<a href="#/messages?booking=${esc(r.id)}" class="booking-conversation ${r.id===selected.id?'selected':''}" ${r.id===selected.id?'aria-current="page"':''}><span class="booking-conversation-icon">${esc((r.customer_name||'G').trim().slice(0,1).toUpperCase())}</span><span><span class="booking-conversation-top"><strong>${esc(r.customer_name||'Guest')}</strong><time>${esc(new Date(r.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))}</time></span><small>${esc(r.boats?.name||'Boat booking')}</small><small>${esc(euroRange(r.start_date,r.end_date))} · ${esc(status(r.status))}</small></span></a>`).join('');
    const displayBookingMessage=(value)=>{const body=String(value||'');if(!/^(?:Hello, I just requested|Hello, I have accepted your request|Unfortunately\b)/i.test(body.trim()))return body;return body.replace(/((?:Thank you|Thanks|Kind regards),?\s*\r?\n)([^\r\n]+)\s*$/i,(_,closing,fullName)=>closing+fullName.trim().split(/\s+/)[0]);};
    const bubbles=messages.map(m=>`<div class="booking-message ${m.sender_id===mine?'outgoing':'incoming'}"><div class="booking-message-bubble"><p>${esc(displayBookingMessage(m.content)).replace(/\n/g,'<br>')}</p><small>${esc(new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}${m.sender_id===mine&&m.read_at?' · Read':''}</small></div></div>`).join('');
    const requestedDates=[bookingLongDate(selected.start_date),bookingLongDate(selected.end_date)].filter(Boolean);
    const dateBanner=requestedDates.length?`<div class="booking-dates-banner"><span class="booking-dates-icon">${icon('calendar')}</span><div><span class="booking-dates-label">REQUESTED RENTAL DATES</span><strong>${esc(requestedDates[0])}${requestedDates.length>1&&requestedDates[1]!==requestedDates[0]?` <span class="booking-dates-separator">–</span> ${esc(requestedDates[1])}`:''}</strong></div></div>`:'';
    const compose=editable?`<form data-live-form="message" data-id="${esc(selected.id)}" class="booking-compose"><label for="booking-message-input">Your message</label><textarea id="booking-message-input" name="content" rows="2" minlength="1" maxlength="2000" placeholder="Ask about the meeting point, arrival time or trip details…" required></textarea><div class="booking-compose-actions"><span>Private to you and the ${profile?.account_type==='owner'?'guest':'owner'} · 2,000 characters max.</span><button class="btn" type="submit">Send message ${icon('arrow')}</button></div><p role="status" data-feedback></p></form>`:`<p class="booking-chat-closed">This booking is ${esc(status(selected.status).toLowerCase())}. The conversation is read-only.</p>`;
    const detailDates=requestedDates.length?requestedDates.map(date=>`<strong>${esc(date)}</strong>`).join('<span class="booking-detail-date-arrow">→</span>'):'<strong>Dates unavailable</strong>';
    const requestCreated=new Date(selected.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    const moneySummary=(price,extras)=>{const base=Number(price)||0,extra=Number(extras)||0,online=bookingGuestTotal(base);return `<div class="offer-price-line"><span>Charter price</span><strong>${money(base)}</strong></div><div class="offer-price-line"><span>Booking fees</span><strong>${money(Math.max(0,online-base))}</strong></div><div class="offer-price-line offer-price-total"><span>Total price</span><strong>${money(online+extra)}</strong></div><div class="offer-price-line offer-net-owner"><span>Net owner</span><strong>${money(base+extra)}</strong></div><div class="offer-net-owner-children"><div class="offer-price-line"><span>Online</span><strong>${money(base)}</strong></div><div class="offer-price-line"><span>On spot</span><strong>${money(extra)}</strong></div></div>`};
    const offerPanel=currentOffer?`<section class="booking-offer-section"><span class="booking-detail-label">SPECIAL OFFER</span><strong class="booking-offer-title">${currentOffer.status==='accepted'?'Offer accepted':offerExpired?'Expired offer':'Personalised offer'}</strong>${isOwner?moneySummary(currentOffer.charter_price,currentOffer.extras_on_site):`<div class="offer-price-line offer-price-total"><span>Total offer price</span><strong>${money(bookingGuestTotal(currentOffer.charter_price)+Number(currentOffer.extras_on_site||0))}</strong></div>`}<p class="booking-offer-expiry">${currentOffer.status==='accepted'?'Accepted':offerExpired?'Expired':'Offer valid until'} ${esc(new Date(currentOffer.expires_at).toLocaleString('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}))}</p>${!isOwner&&currentOffer.status==='sent'&&!offerExpired&&selected.status==='pending_owner'?`<button class="btn booking-offer-accept" data-live="accept-special-offer" data-id="${esc(currentOffer.id)}">Accept offer</button>`:''}</section>`:'';
    const ownerOfferForm=isOwner&&selected.status==='pending_owner'?`<form class="booking-offer-form live-form" data-live-form="special-offer" data-id="${esc(selected.id)}"><h3>${currentOffer?'Create a new personalised offer':'Send special offer'}</h3><label>Charter payout (€)<input type="number" name="charter_price" min="1" max="1000000" step="0.01" required value="${esc(Number(currentOffer?.charter_price||selected.charter_price||0).toFixed(2))}"></label><label>Optional extras paid at check-in (€)<input type="number" name="extras_on_site" min="0" max="100000" step="0.01" value="${esc(Number(currentOffer?.extras_on_site||0).toFixed(2))}"></label><label>Offer validity period<select name="validity_days"><option value="1">24 hours</option><option value="3" selected>3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></label><button class="btn" type="submit">Send special offer</button><p data-feedback role="status"></p></form>`:'';
    const details=`<aside class="booking-details"><div class="booking-details-heading"><h2>Details</h2><span class="live-status">${esc(status(selected.status))}</span></div><div class="booking-detail-group"><span class="booking-detail-label">BOAT</span><div class="booking-detail-boat">${icon('ship')}<strong>${esc(selected.boats?.name||'Boat booking')}</strong></div></div><div class="booking-detail-group"><span class="booking-detail-label">REQUESTED RENTAL DATES</span><div class="booking-detail-dates">${icon('calendar')}<div>${detailDates}</div></div></div><div class="booking-detail-group"><span class="booking-detail-label">RENTAL OPTION</span><div class="booking-detail-row">${icon('user')}<span>${selected.with_skipper?'With skipper':'Without skipper'}</span></div></div><div class="booking-detail-group"><span class="booking-detail-label">REQUEST SENT</span><div class="booking-detail-row">${icon('clock')}<span>${esc(requestCreated)}</span></div></div><div class="booking-detail-group"><span class="booking-detail-label">CHECK-IN / CHECK-OUT</span><div class="booking-detail-row">${icon("clock")}<span>${esc(boatClock(selected.boats?.check_in_time,"09:00"))} → ${esc(boatClock(selected.boats?.check_out_time,"18:00"))}</span></div></div>${isOwner?`<div class="booking-detail-group"><span class="booking-detail-label">PRICE DETAILS</span>${moneySummary(selected.charter_price||0,0)}</div>`:'' }${offerPanel}${ownerOfferForm}<div class="booking-detail-footnote">No payment is collected until payment processing is available.</div></aside>`;
    return page('Messages',`<div class="booking-messenger booking-messenger-three"><aside class="booking-conversations"><h2><a class="booking-messages-back" href="${isOwner?'#/owner?view=requests':'#/bookings'}" aria-label="Back to ${isOwner?'owner dashboard':'my bookings'}" title="Back to menu">←</a> Messages <span>${rows.length}</span></h2>${conversations}</aside><section class="booking-chat" data-booking-id="${esc(selected.id)}"><div class="booking-chat-heading"><div><span class="member-eyebrow">CONVERSATION</span><h2>${esc(selected.customer_name||'Guest')}</h2><p>${esc(selected.boats?.name||'Boat booking')}</p></div></div><div class="booking-thread" role="log" aria-label="Booking messages">${bubbles||'<div class="booking-thread-empty">No messages yet. Say hello and agree on trip details here.</div>'}</div>${compose}</section>${details}</div>`);
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
      if(current&&status==='approved'){
        return `<article class="profile-panel verification-staff-card verification-complete-card"><div class="verification-heading"><div><span class="verification-complete-eyebrow">Customer verification</span><h2>${esc(p?.display_name||'Customer')}</h2><p>Verified ${esc(review.reviewed_at?.slice(0,10)||'')}</p></div><span class="verification-badge approved">✓ Verified</span></div><div class="verification-complete-details"><span><strong>Identity</strong>${r.identity_type==='passport'?'Passport':'National ID'}</span><span><strong>Boat licence</strong>${esc(r.licence_type)}</span><span><strong>Valid until</strong>${esc(r.licence_expiry||'No expiry')}</span></div><div class="verification-complete-footer"><p class="verification-complete-note"><span class="verification-check-dot" aria-hidden="true">✓</span>Documents reviewed and approved</p><div class="verification-email-controls"><button type="button" class="verification-email-action" data-verification-email="${esc(r.user_id)}">Send confirmation email <span aria-hidden="true">↗</span></button><span class="verification-email-feedback" role="status"></span></div></div></article>`;
      }
      return `<article class="profile-panel verification-staff-card"><div class="verification-heading"><div><h2>${esc(p?.display_name||'Customer')}</h2><p>Submitted ${esc(r.submitted_at?.slice(0,10)||'')} · DOB ${esc(r.birth_date)}</p></div><span class="verification-badge ${esc(status)}">${esc(verificationLabel(status))}</span></div><p><strong>Identity:</strong> ${r.identity_type==='passport'?'Passport':'National ID'} · <strong>Licence:</strong> ${esc(r.licence_type)} · <strong>Expiry:</strong> ${esc(r.licence_expiry||'Permanent / not specified')}</p>${p?.details?.birth_date?`<p>Customer profile date of birth: ${esc(p.details.birth_date)}</p>`:''}<div class="verification-document-links">${documentLink(idFile,'ID / passport')}${documentLink(licenceFile,'boat driving licence')}</div>${current&&review?.note?`<p>Previous decision note: ${esc(review.note)}</p>`:''}<form class="live-form verification-review-form" data-live-form="review" data-id="${esc(r.user_id)}"><label>Decision<select name="status" required><option value="approved">Approve documents</option><option value="rejected">Reject / request correction</option></select></label><label class="live-check"><input type="checkbox" name="identity_matches"> I checked that the ID/passport is genuine-looking and matches the customer's legal name and date of birth.</label><label class="live-check"><input type="checkbox" name="licence_matches"> I checked the licence holder matches the ID/passport, and the licence category and validity are suitable.</label><label>Message to customer (required if rejected)<textarea name="note" rows="2" maxlength="1000" placeholder="Explain which details need correction."></textarea></label><button class="btn" type="submit">Save review decision</button><p role="status" data-feedback></p></form></article>`;
    }));
    const ownerRows=check(await client.from('owner_verification_requests').select('*').eq('application_state','submitted').order('submitted_at',{ascending:false}).limit(50));
    const ownerReviews=ownerRows.length?check(await client.from('owner_verification_reviews').select('*').in('user_id',ownerRows.map(r=>r.user_id))):[];
    const ownerProfiles=ownerRows.length?check(await client.from('profiles').select('id,display_name').in('id',ownerRows.map(r=>r.user_id))):[];
    const ownerCards=await Promise.all(ownerRows.map(async r=>{
      const p=ownerProfiles.find(x=>x.id===r.user_id),review=ownerReviews.find(x=>x.user_id===r.user_id);
      const isCurrent=ownerReviewIsCurrent(r,review,p?.display_name),s=isCurrent?review.status:'pending';
      const paths=[['Registration',r.registration_path],['ID / passport',r.identity_path],['Bank account proof',r.iban_proof_path]];
      const signed=isCurrent&&s==='approved'?[]:await Promise.all(paths.map(async ([label,path])=>{
        const result=await client.storage.from('owner-verification-documents').createSignedUrl(path,300);
        return result.error?`<span class="member-note">${esc(label)} unavailable</span>`:`<a href="${esc(result.data.signedUrl)}" target="_blank" rel="noopener noreferrer" class="member-outline-action">View ${esc(label)} · 5-minute link ${icon('arrow')}</a>`;
      }));
      if(isCurrent&&s==='approved'){
        return `<article class="profile-panel verification-staff-card verification-complete-card"><div class="verification-heading"><div><span class="verification-complete-eyebrow">Business verification</span><h2>${esc(r.legal_business_name)}</h2><p>Owner: ${esc(p?.display_name||'Unknown')} · Verified ${esc(review.reviewed_at?.slice(0,10)||'')}</p></div><span class="verification-badge approved">✓ Verified</span></div><div class="verification-complete-footer"><p class="verification-complete-note"><span class="verification-check-dot" aria-hidden="true">✓</span>Business documents reviewed and approved</p></div></article>`;
      }
      return `<article class="profile-panel verification-staff-card"><div class="verification-heading"><div><h2>${esc(r.legal_business_name)}</h2><p>Owner: ${esc(p?.display_name||'Unknown')} · Submitted ${esc(r.submitted_at?.slice(0,10)||'')}</p></div><span class="verification-badge ${esc(s)}">${esc(verificationLabel(s))}</span></div><p><strong>Country / registration:</strong> ${esc(r.business_country)} · ${esc(r.tax_identifier)}<br><strong>Registered address:</strong> ${esc(r.registered_address)}<br><strong>Website:</strong> <a href="${esc(r.business_website)}" target="_blank" rel="noopener noreferrer">${esc(r.business_website)}</a><br><strong>Business bank account:</strong> ${esc(r.payout_bank_details?.method==='local'?(`${r.payout_bank_details.country} · Account ${r.payout_bank_details.account_number} · Bank/routing ${r.payout_bank_details.routing_number}${r.payout_bank_details.swift_bic?' · SWIFT/BIC '+r.payout_bank_details.swift_bic:''}`):r.iban||'Not provided')} · ${esc(r.iban_holder)}<br><strong>Identity document:</strong> ${r.identity_type==='passport'?'Passport':'National ID'}</p><div class="verification-document-links">${signed.join('')}</div>${isCurrent&&review?.note?`<p>Previous decision note: ${esc(review.note)}</p>`:''}<form class="live-form verification-review-form" data-live-form="owner-review" data-id="${esc(r.user_id)}"><label>Decision<select name="status" required><option value="approved">Approve business</option><option value="rejected">Reject / request correction</option></select></label><label class="live-check"><input type="checkbox" name="registration_matches"> I checked the business registration, country and registration number (OIB / SIRET / other).</label><label class="live-check"><input type="checkbox" name="identity_matches"> I checked the owner / manager identity and authority to represent the business.</label><label class="live-check"><input type="checkbox" name="bank_matches"> I checked that the business bank account belongs to the registered business and verified its website and address.</label><label>Message to owner (required if rejected)<textarea name="note" rows="2" maxlength="1000" placeholder="Explain what needs correction"></textarea></label><button class="btn" type="submit">Save owner verification</button><p role="status" data-feedback></p></form></article>`;
    }));
    return page('Staff verification',`<p>Restricted reviewer area. Documents are private and accessible only through short-lived signed links. Approving owners unlocks publication of new listings.</p><h2>Business / owner verification (${ownerRows.length})</h2><div class="verification-staff-list">${ownerCards.join('')||'<div class="profile-panel">No owner verification requests yet.</div>'}</div><h2>Customer ID & boat licence (${rows.length})</h2><div class="verification-staff-list">${cards.join('')||'<div class="profile-panel">No customer verification requests yet.</div>'}</div>`);
  }
  async function adminReservationsPage(){
    if(!superAdmin)return page('Reservations','<div class="profile-panel"><h2>Access restricted</h2><p>Only the Super Admin can view all reservations.</p></div>');
    const rows=check(await client.rpc('super_admin_reservations'));
    const confirmed=rows.filter(r=>r.status==='confirmed');
    const sum=(list,key)=>list.reduce((total,r)=>total+(Number(r[key])||0),0);
    const summary=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:20px 0 28px">
      <div class="profile-panel" style="margin:0"><span class="member-page-kicker">ALL REQUESTS</span><h2>${rows.length}</h2><p>Reservation requests</p></div>
      <div class="profile-panel" style="margin:0"><span class="member-page-kicker">CONFIRMED BOOKINGS</span><h2>${confirmed.length}</h2><p>Accepted reservations</p></div>
      <div class="profile-panel" style="margin:0"><span class="member-page-kicker">PLATFORM COMMISSION</span><h2>${money(sum(confirmed,'commission'))}</h2><p>On confirmed reservations</p></div>
      <div class="profile-panel" style="margin:0"><span class="member-page-kicker">OWNER PAYOUT</span><h2>${money(sum(confirmed,'charter_price'))}</h2><p>On confirmed reservations</p></div>
    </div>`;
    if(!rows.length)return page('Reservations',`<p>View reservations, rental dates and the financial breakdown in one place.</p>${summary}<div class="profile-panel" style="text-align:center;padding:45px 20px"><h2>No reservations yet</h2><p>New booking requests will appear here automatically.</p></div>`);
    const tr=rows.map(r=>`<tr>
      <td style="padding:14px 12px"><strong>${esc(r.boat_name||'Boat')}</strong><br><small>${esc(r.customer_name||'Traveller')} · ${esc(r.owner_name||'Owner')}</small></td>
      <td style="padding:14px 12px;white-space:nowrap">${esc(euroDate(r.start_date))} – ${esc(euroDate(r.end_date))}</td>
      <td style="padding:14px 12px"><span class="member-status">${esc(status(r.status))}</span></td>
      <td style="padding:14px 12px;text-align:right">${money(r.total||0)}</td>
      <td style="padding:14px 12px;text-align:right">${money(r.commission||0)}</td>
      <td style="padding:14px 12px;text-align:right">${money(r.processing_fee||0)}</td>
      <td style="padding:14px 12px;text-align:right"><strong>${money(r.charter_price||0)}</strong></td>
    </tr>`).join('');
    return page('Reservations',`<p>All reservation requests, dates and financial breakdown. Amounts for pending requests are estimates until payment is confirmed.</p>${summary}<section class="profile-panel" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left;min-width:950px"><thead><tr style="border-bottom:1px solid #dce8ed"><th style="padding:14px 12px">Boat / traveller / owner</th><th style="padding:14px 12px">Rental dates</th><th style="padding:14px 12px">Status</th><th style="padding:14px 12px;text-align:right">Guest total</th><th style="padding:14px 12px;text-align:right">Commission</th><th style="padding:14px 12px;text-align:right">Processing</th><th style="padding:14px 12px;text-align:right">Owner net</th></tr></thead><tbody>${tr}</tbody></table></section>`);
  }
  async function route(){const {path,params}=parseRoute();if(!['/boats','/owner','/bookings','/account','/login','/dashboard','/favourites','/staff','/reservations','/messages'].includes(path)&&!path.startsWith('/listing/'))return null;
    if(!client)return ['/login','/owner','/bookings','/account','/dashboard','/favourites','/staff','/reservations','/messages'].includes(path)?loginPage():page('Welcome aboard.','<p>Connecting your account…</p>');
    if(path==='/login'&&session&&!recovery){location.hash=afterLogin();return !profile?profileDialog(authNext):page('Welcome back.','<p>Opening your account…</p>')}
    if(path==='/login')return loginPage();
    if(path==='/owner'&&!session)return loginPage();
    if(session&&profile&&['/dashboard','/owner','/account','/bookings','/favourites','/messages'].includes(path)&&!superAdmin&&!verificationStaff){
      try{await refreshSidebarNotifications()}catch(error){console.warn('Notification counts unavailable',error?.message||error)}
    }
    if(path==='/boats') {
      const boats=check(await client.from('boats').select('*').eq('published',true).order('created_at',{ascending:false}));
      const rawSearch=(params.get('location')||params.get('country')||'').trim();
      const foldCity=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[đð]/g,'d').replace(/ı/g,'i').replace(/ł/g,'l').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ß/g,'ss').replace(/þ/g,'th').trim();
      const searchInput=window.resolveDestinationName?.(rawSearch,destinationCities)||rawSearch;
      const search=foldCity(searchInput);
      const types=params.getAll('type').filter(v=>['Motorboat','RIB','Sailboat','Catamaran','Yacht','Jetski'].includes(v));
      const skipper=['with','without'].includes(params.get('skipper'))?params.get('skipper'):'';
      const licenceNotRequired=params.get('licence_not_required')==='1';
      const withSkipperOnly=params.get('with_skipper_only')==='1';
      const guests=Math.max(1,Math.min(100,Number(params.get('guests'))||1));
      const minPrice=Math.max(0,Number(params.get('min_price'))||0),maxPrice=Math.max(0,Number(params.get('max_price'))||0);
      const cabins=Math.max(0,Math.min(100,Number(params.get('cabins'))||0));
      const berths=Math.max(0,Math.min(100,Number(params.get('berths'))||0));
      const engineMin=Math.max(0,Math.min(400,Number(params.get('engine_min'))||0));
      const engineMax=params.has('engine_max')?Math.max(engineMin,Math.min(400,Number(params.get('engine_max'))||400)):400;
      const minLength=Math.max(0,Math.min(15,Number(params.get('min_length'))||0));
      const maxLength=params.has('max_length')?Math.max(minLength,Math.min(15,Number(params.get('max_length'))||15)):15;
      const selectedEquipment=params.getAll('equipment').filter(v=>["gps","outdoor_speakers","bimini","electric_windlass","outdoor_shower","water_skis","banana","towable_tube","wakeboard","air_conditioning","autopilot","dinghy","bow_thruster"].includes(v));
      const countryChoices=["Croatia","Greece","Spain","France","Italy","Malta","Portugal","Cyprus","Montenegro","Turkey","Albania","Australia","Bahamas","United States"];
      const selectedCountry=countryChoices.includes(params.get('country'))?params.get('country'):'';
      const yearMin=Math.max(2006,Math.min(2026,Number(params.get('year_min'))||2006));
      const yearMax=params.has('year_max')?Math.max(yearMin,Math.min(2026,Number(params.get('year_max'))||2026)):2026;
      const sorting=['newest','price-low','price-high'].includes(params.get('sort'))?params.get('sort'):'newest';
      const cardLayout=params.get('layout')==='list'?'list':'grid';
      const layoutHref=mode=>{const q=new URLSearchParams(params);if(mode==='grid')q.delete('layout');else q.set('layout','list');return '#/boats?'+q.toString();};
      const startDate=/^\d{4}-\d{2}-\d{2}$/.test(params.get('start')||'')?params.get('start'):'';
      const endDate=/^\d{4}-\d{2}-\d{2}$/.test(params.get('end')||'')?params.get('end'):'';
      let filtered=boats.filter(b=>{
        const where=!search||foldCity(`${b.location||''}, ${b.country||''}`).includes(search)||foldCity(b.country||'')===search||(search==='united states'&&foldCity(b.country||'')==='usa')||(search==='usa'&&foldCity(b.country||'')==='united states');
        const typeOk=!types.length||types.includes(b.type);
        const countryOk=!selectedCountry||foldCity(b.country)===(selectedCountry==='United States'?foldCity('USA'):foldCity(selectedCountry))||(selectedCountry==='United States'&&foldCity(b.country)===foldCity('United States'));
        const built=Number((b.specifications||{}).build_year)||0;
        const yearOk=(yearMin===2006||built>=yearMin)&&(yearMax===2026||built>0&&built<=yearMax);
        const skipperOk=!skipper||(skipper==='with'?b.with_skipper===true:b.without_skipper!==false);
        const price=guestDailyRate(b.price);
        const specs=b.specifications||{};
        const length=Number(specs.length_m)||0;
        const hp=Number(specs.engine_hp)||0;
        const equipped=Array.isArray(specs.equipment)?specs.equipment:[];
        return where&&typeOk&&countryOk&&yearOk&&skipperOk&&(!licenceNotRequired||(b.licence_required===false&&b.without_skipper!==false))&&(!withSkipperOnly||(b.with_skipper===true&&b.without_skipper===false))&&Number(b.guests)>=guests&&(!cabins||Number(specs.cabins)>=cabins)&&(!berths||Number(specs.berths)>=berths)&&(!engineMin||hp>=engineMin)&&(engineMax===400||hp<=engineMax)&&(!minPrice||price>=minPrice)&&(!maxPrice||price<=maxPrice)&&(!minLength||length>=minLength)&&(maxLength===15||length<=maxLength)&&selectedEquipment.every(id=>equipped.includes(id));
      });
      if(sorting==='price-low')filtered.sort((a,b)=>guestDailyRate(a.price)-guestDailyRate(b.price));
      if(sorting==='price-high')filtered.sort((a,b)=>guestDailyRate(b.price)-guestDailyRate(a.price));
      const fullCountry=searchInput==='USA'?'United States':searchInput;
      const heading=searchInput?`Boat rentals in <i>${esc(fullCountry)}</i>`:'Find your next <i>day at sea.</i>';
      const typeChoices=[['Motorboat','Motorboat'],['RIB','RIB'],['Sailboat','Sailboat'],['Catamaran','Catamaran'],['Yacht','Yacht'],['Jetski','Jetski']];
      const amenities=[["gps","GPS"],["outdoor_speakers","External speakers"],["bimini","Bimini"],["electric_windlass","Electric windlass"],["outdoor_shower","Outdoor shower"],["water_skis","Water skis"],["banana","Inflatable banana"],["towable_tube","Tube"],["wakeboard","Wakeboard"],["air_conditioning","Air Conditioning"],["autopilot","Autopilot"],["dinghy","Dinghy"],["bow_thruster","Bow thruster"]];
      const checkField=(name,value,label,selected)=>`<label class="rental-check"><input type="checkbox" name="${name}" value="${value}" ${selected?'checked':''}><span>${label}</span></label>`;
      const query=new URLSearchParams();
      if(startDate)query.set('start',startDate);if(endDate)query.set('end',endDate);query.set('guests',String(guests));
      const listingQuery=query.toString()?'?'+query.toString():'';
      const favoriteBoatIds=session&&profile?.account_type==='customer'?new Set(check(await client.from('favourites').select('boat_id').eq('user_id',session.user.id)).map(row=>row.boat_id)):new Set();
      const cards=filtered.map(b=>`<article class="rental-card-shell"><a class="rental-card" href="#/listing/${encodeURIComponent(b.id)}${listingQuery}">
        <div class="rental-card-photo">${picture(b)}</div>
        <div class="rental-card-body">
          <div class="rental-card-location">${icon('pin')} ${esc(b.location)}, ${esc(b.country)}</div>
          <h3>${esc(b.name)}</h3>
          <div class="rental-card-badges"><span class="rental-card-badge">${icon('ship')} ${b.with_skipper===true?(b.without_skipper!==false?'Skipper optional':'Skipper included'):'Self-drive only'}</span><span class="rental-card-badge">${esc(b.type)}</span>${b.specifications?.pets_allowed===true?`<span class="rental-card-badge">${icon('check')} Pets allowed</span>`:''} </div>
          <div class="rental-card-specs"><span><strong>${Number(b.guests)||1}</strong> ${(Number(b.guests)||1)===1?'person':'people'}</span>${Number(b.specifications?.engine_hp)>0?`<span><strong>${Number(b.specifications.engine_hp)}</strong> HP</span>`:''}${Number(b.specifications?.length_m)>0?`<span><strong>${Number(b.specifications.length_m)}</strong> m</span>`:''}</div>
          <div class="rental-card-bottom"><span>From <strong>${money(guestDailyRate(b.price))}</strong> / day</span><span class="rental-view-link">View boat ${icon('arrow')}</span></div>
        </div>
      </a><button type="button" class="rental-favorite ${favoriteBoatIds.has(b.id)?'is-saved':''}" data-live="${favoriteBoatIds.has(b.id)?'unfavourite':'favourite'}" data-id="${esc(b.id)}" aria-label="${favoriteBoatIds.has(b.id)?'Remove from favorites':'Add to favorites'}" aria-pressed="${favoriteBoatIds.has(b.id)}" title="${favoriteBoatIds.has(b.id)?'Remove from favorites':'Add to favorites'}">${icon('heart')}</button></article>`).join('');
      return `${header('boats')}<main class="rental-page">
        <div class="shell rental-heading"><div><div class="rental-eyebrow">GET BY BOAT · EXPLORE</div><h1>${heading}</h1><p>Discover beautiful boats and compare your options.</p></div><span class="rental-request-note">${icon('shield')} Every booking is upon request</span></div>
        <form class="rental-search-form shell" data-live-form="search"><input type="hidden" name="layout" value="${cardLayout}">
          <div class="rental-search-bar">
            <label class="rental-where"><span><svg class="icon" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z" fill="currentColor" fill-opacity=".2"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg> Where</span><input name="location" list="boat-destinations" type="search" placeholder="City or country" value="${esc(searchInput)}" autocomplete="off"></label>${destinationDatalist()}
            <label class="rental-date-field"><span>${icon('calendar')} From</span><input name="start" type="hidden" value="${esc(startDate)}"><button type="button" class="rental-date-trigger" data-rental-date-open="start" aria-label="Select start date">${startDate?formatRentalDate(startDate):'dd/mm/yyyy'} ${icon('calendar')}</button></label>
            <label class="rental-date-field"><span>${icon('calendar')} To</span><input name="end" type="hidden" value="${esc(endDate)}"><button type="button" class="rental-date-trigger" data-rental-date-open="end" aria-label="Select end date">${endDate?formatRentalDate(endDate):'dd/mm/yyyy'} ${icon('calendar')}</button></label>
            <button class="btn rental-search-button" type="submit">${icon('search')} Search</button>
          </div>
          <div class="rental-layout">
            <aside class="rental-sidebar" aria-label="Filter boats">
              <div class="rental-sidebar-head"><h2>Filters</h2><a href="#/boats">Clear all</a></div>
              <fieldset><legend>Boat types</legend><div class="rental-check-list">${typeChoices.map(([value,label])=>checkField('type',value,label,types.includes(value))).join('')}</div></fieldset>
              <fieldset class="rental-licence-section"><label class="rental-check"><input type="checkbox" name="licence_not_required" value="1" ${licenceNotRequired?'checked':''}><span>License not required</span></label><label class="rental-check"><input type="checkbox" name="with_skipper_only" value="1" ${withSkipperOnly?'checked':''}><span>With skipper</span></label></fieldset>
              <fieldset class="rental-price-section"><legend>Price per day</legend><div class="rental-double-slider" data-rental-range="price"><div class="rental-slider-track"></div><div class="rental-slider-active" style="left:${Math.min(minPrice,1200)/12}%;right:${100-Math.min(maxPrice||1200,1200)/12}%"></div><input type="range" name="price_slider_min" min="0" max="1200" step="25" value="${Math.min(minPrice,1200)}" aria-label="Minimum price per day"><input type="range" name="price_slider_max" min="0" max="1200" step="25" value="${Math.min(maxPrice||1200,1200)}" aria-label="Maximum price per day"></div><div class="rental-price-fields"><label>Minimum<span class="rental-price-number">€ <input type="number" min="0" step="25" name="min_price" placeholder="0" value="${minPrice||0}"></span></label><span class="rental-price-dash">−</span><label>Maximum<span class="rental-price-number">€ <input type="number" min="0" step="25" name="max_price" placeholder="1200+" value="${maxPrice||''}"></span></label></div></fieldset>
              <fieldset class="rental-counter-section"><div class="rental-counter-row"><span class="rental-counter-label">Number of people</span><div class="rental-guest-stepper"><button type="button" data-rental-guest-step="-1" aria-label="Decrease passengers" ${guests<=1?'disabled':''}>−</button><input name="guests" type="number" min="1" max="100" value="${guests}" aria-label="Number of passengers"><button type="button" data-rental-guest-step="1" aria-label="Increase passengers" ${guests>=100?'disabled':''}>+</button></div></div></fieldset>
              <fieldset class="rental-counter-section"><div class="rental-counter-row"><span class="rental-counter-label">Number of cabins</span><div class="rental-guest-stepper"><button type="button" data-rental-step="cabins:-1" aria-label="Decrease cabins" ${cabins<=0?'disabled':''}>−</button><input name="cabins" type="number" min="0" max="100" value="${cabins}" aria-label="Number of cabins"><button type="button" data-rental-step="cabins:1" aria-label="Increase cabins" ${cabins>=100?'disabled':''}>+</button></div></div></fieldset>
              <fieldset class="rental-counter-section"><div class="rental-counter-row"><span class="rental-counter-label">Number of berths</span><div class="rental-guest-stepper"><button type="button" data-rental-step="berths:-1" aria-label="Decrease berths" ${berths<=0?'disabled':''}>−</button><input name="berths" type="number" min="0" max="100" value="${berths}" aria-label="Number of berths"><button type="button" data-rental-step="berths:1" aria-label="Increase berths" ${berths>=100?'disabled':''}>+</button></div></div></fieldset>
              <fieldset class="rental-range-section" aria-label="Boat length"><div class="rental-range-head"><span>Boat length</span><div class="rental-length-label"><output data-length-summary>${minLength} - ${maxLength===15?'15+':maxLength} m</output></div></div><div class="rental-double-slider" data-rental-length><div class="rental-slider-track"></div><div class="rental-slider-active" style="left:${minLength/15*100}%;right:${100-maxLength/15*100}%"></div><input type="range" name="min_length" min="0" max="15" step="1" value="${minLength}" aria-label="Minimum boat length"><input type="range" name="max_length" min="0" max="15" step="1" value="${maxLength}" aria-label="Maximum boat length"></div><div class="rental-length-ticks"><span>0 m</span><span>15+ m</span></div></fieldset><fieldset class="rental-range-section" aria-label="Engine power"><div class="rental-range-head"><span>Engine power</span><div class="rental-length-label"><output data-range-summary>${engineMin} - ${engineMax===400?'400+':engineMax} hp</output></div></div><div class="rental-double-slider" data-rental-range="engine"><div class="rental-slider-track"></div><div class="rental-slider-active" style="left:${engineMin/400*100}%;right:${100-engineMax/400*100}%"></div><input type="range" name="engine_min" min="0" max="400" step="25" value="${engineMin}" aria-label="Minimum engine power"><input type="range" name="engine_max" min="0" max="400" step="25" value="${engineMax}" aria-label="Maximum engine power"></div><div class="rental-length-ticks"><span>0 hp</span><span>400+ hp</span></div></fieldset>
              <fieldset><legend>Equipment</legend><div class="rental-check-list">${amenities.map(([value,label])=>checkField('equipment',value,label,selectedEquipment.includes(value))).join('')}</div></fieldset>
              <fieldset class="rental-range-section" aria-label="Year of manufacture"><div class="rental-range-head"><span>Year of manufacture</span><div class="rental-length-label"><output data-year-summary>${yearMin} - ${yearMax}</output></div></div><div class="rental-double-slider" data-rental-range="year"><div class="rental-slider-track"></div><div class="rental-slider-active" style="left:${(yearMin-2006)/20*100}%;right:${(2026-yearMax)/20*100}%"></div><input type="range" name="year_min" min="2006" max="2026" step="1" value="${yearMin}" aria-label="Minimum year of manufacture"><input type="range" name="year_max" min="2006" max="2026" step="1" value="${yearMax}" aria-label="Maximum year of manufacture"></div></fieldset>
                            <button type="submit" class="btn rental-filter-button">Show matching boats ${icon('arrow')}</button>
              <p class="rental-sidebar-note">Owners review each booking request. Online payment is not enabled yet.</p>
            </aside>
            <section class="rental-results" aria-label="Boat search results">
              <div class="rental-results-bar"><div><strong>${filtered.length} ${filtered.length===1?'boat':'boats'} found</strong><span>${searchInput?' · '+esc(fullCountry):' · Browse all destinations'}</span></div><button type="button" class="rental-mobile-filters" data-rental-filters-toggle aria-expanded="false">${icon('filter')} Filters</button><div class="rental-results-controls"><label class="rental-sort-control"><span>Sort by</span><select name="sort"><option value="newest">Newest listings</option><option value="price-low" ${sorting==='price-low'?'selected':''}>Price: low to high</option><option value="price-high" ${sorting==='price-high'?'selected':''}>Price: high to low</option></select></label><div class="rental-layout-switch" role="group" aria-label="Results layout"><a class="rental-layout-option" href="${layoutHref('grid')}" ${cardLayout==='grid'?'aria-current="true"':''}>▦ Grid</a><a class="rental-layout-option" href="${layoutHref('list')}" ${cardLayout==='list'?'aria-current="true"':''}>☰ List</a></div></div></div>
              <style>.rental-page .rental-card h3{font:700 22px/1.22 var(--sans)!important;letter-spacing:-.035em;color:#163f4c;margin-bottom:11px}.rental-page .rental-card-body{font-family:var(--sans);letter-spacing:-.01em}.rental-page .rental-card-location{font-size:12px}.rental-page .rental-results-bar strong{font-family:var(--sans);font-weight:750;letter-spacing:-.02em}.rental-results-controls{display:flex;align-items:center;gap:10px;margin-left:auto}.rental-sort-control{display:inline-flex!important;align-items:center;gap:9px;margin:0!important;padding:4px 5px 4px 13px;background:#ecf5f7;border:1px solid #e0edf0;border-radius:12px;color:#1f2933;font:650 12px/1.2 var(--sans)!important;letter-spacing:-.01em;white-space:nowrap}.rental-sort-control select{width:auto;max-width:180px;height:35px;min-height:35px;padding:6px 30px 6px 12px;margin:0;border:1px solid #e5edf0;border-radius:9px;background:#fff;color:#1f2933;font:650 12px var(--sans);letter-spacing:-.015em;box-shadow:0 1px 4px #0b4d5c0c}.rental-sort-control select:focus{outline:2px solid #24a7bf;outline-offset:1px}.rental-sort-control select option{color:#111827!important;background:#fff!important;font:600 13px var(--sans);padding:10px 12px}@media(max-width:770px){.rental-results-controls{width:100%;justify-content:flex-end;flex-wrap:wrap;gap:8px}.rental-sort-control select{max-width:155px}}.rental-layout-switch{display:inline-flex;align-items:center;gap:3px;background:#ecf5f7;padding:4px;border-radius:12px}.rental-layout-option{padding:8px 12px;border-radius:9px;color:#416675;font-weight:700;font-size:12px;text-decoration:none;white-space:nowrap}.rental-layout-option[aria-current=true]{background:#fff;color:#0089a4;box-shadow:0 1px 5px #0b4d5c18}.rental-card-grid.is-list{grid-template-columns:minmax(0,1fr)!important}.rental-card-grid.is-list .rental-card{flex-direction:row;min-height:230px}.rental-card-grid.is-list .rental-card-photo{height:auto;min-height:230px;flex:0 0 min(38%,370px)}.rental-card-grid.is-list .rental-card-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}.rental-card-grid.is-list .rental-card-bottom{margin-top:auto}.rental-card-grid.is-list .rental-favorite{top:14px;right:14px}.rental-card-grid.is-list .rental-card-photo img{object-fit:cover}@media(max-width:650px){.rental-card-grid.is-list .rental-card{min-height:170px}.rental-card-grid.is-list .rental-card-photo{min-height:170px;flex-basis:38%}.rental-card-grid.is-list .rental-card-body{padding:12px}.rental-card-grid.is-list .rental-card-badges,.rental-card-grid.is-list .rental-card-specs{display:none}.rental-card-grid.is-list .rental-card-bottom{font-size:12px}}@media(max-width:440px){.rental-card-grid.is-list .rental-card-photo{flex-basis:42%}.rental-layout-option{padding:7px 9px}}</style>
              ${cards?`<div class="rental-card-grid ${cardLayout==='list'?'is-list':''}">${cards}</div>`:`<div class="rental-empty"><div class="rental-empty-icon">${icon('ship')}</div><h2>No boats match just yet.</h2><p>${searchInput?'We are growing our fleet in '+esc(fullCountry)+'. Try fewer filters or explore another destination.':'Try adjusting your filters or explore all available destinations.'}</p><a href="#/boats" class="btn">Explore all boats ${icon('arrow')}</a></div>`}
            </section>
          </div>
        </form>
      </main>${footer()}`;
    }
    if(path.startsWith('/listing/')) {
      for(const [key,name] of [['start','start'],['end','end']]){const value=params.get(key);if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))state[name]=value;}
      const selectedGuests=Math.max(1,Math.min(100,Number(params.get('guests'))||1));
      const b=check(await client.from('boats').select('*').eq('id',path.slice(9)).limit(1))[0];
      if(!b)return page('This boat is not available right now.',`<div class="listing-unavailable"><div class="listing-unavailable-icon">${icon('ship')}</div><h2>Still dreaming of a day at sea?</h2><p>This listing is currently unavailable. Browse other boats and find one that’s ready for your next adventure.</p><a class="btn" href="#/boats">Explore available boats ${icon('arrow')}</a></div>`);
      const unavailable=check(await client.rpc('public_boat_availability',{p_boat:b.id}));
      const reviews=check(await client.from('owner_reviews').select('boat_id,owner_id,rating,comment,created_at').eq('owner_id',b.owner_id).order('created_at',{ascending:false}).limit(100));
      const savedFavourite=session&&profile?.account_type==='customer'?!!check(await client.from('favourites').select('boat_id').eq('user_id',session.user.id).eq('boat_id',b.id).limit(1)).length:false;
      listingCalendarContext={unavailable};listingCalendarSelection=null;
      const exactPickup=session&&profile?.account_type!=='owner'?check(await client.from('boat_pickups').select('pickup_address,latitude,longitude').eq('boat_id',b.id).maybeSingle()):null;
      const isOwner=profile?.account_type==='owner',hasSkipper=b.with_skipper===true,hasBareboat=b.without_skipper!==false;
      const preferred=params.get('skipper')==='without'?'without':params.get('skipper')==='with'?'with':null;
      const mode=preferred==='with'&&hasSkipper?'with':preferred==='without'&&hasBareboat?'without':hasBareboat?'without':'with';
      const needsVerification=session&&!isOwner&&mode==='without'&&b.licence_required!==false&&(verificationState()!=='approved'||!!(verificationRequest?.licence_expiry&&state.end&&state.end>verificationRequest.licence_expiry));
      const skipperDailyFee=Math.max(0,Number(b.skipper_fee_per_day)||0);
      const skipperPriceLabel=skipperDailyFee>0?`(+${money(skipperDailyFee)} / day)`:'(price on request)';
      const choices=hasSkipper&&hasBareboat
        ?`<div class="listing-rental-choices"><label class="listing-rental-choice listing-skipper-addon"><input type="checkbox" name="need_skipper" data-needs-skipper ${mode==='with'?'checked':''}><span><strong>I need a skipper</strong></span><b class="listing-rental-extra">${skipperPriceLabel}</b></label><input type="hidden" name="skipper" value="${mode}"></div>`
        :`<div class="listing-rental-fixed">${hasSkipper?'Professional skipper included with boat':'Self-drive only'}</div><input type="hidden" name="skipper" value="${hasSkipper?'with':'without'}">`;
      const warning=`<div class="verification-booking-block" data-skipper-verification ${needsVerification?'':'hidden'}><strong>${icon('shield')} Licence verification required</strong><p>Renting without a skipper requires a verified ID/passport and a valid boat driving licence for the rental dates.<br><span class="verification-status-line">${esc(verificationLabel(verificationState()))}.</span></p><a href="#/account?tab=verification">Go to verification ${icon('arrow')}</a></div>`;
      const included=hasSkipper&&!hasBareboat;
      const rentalHighlights=`<div class="listing-highlight-row">${hasBareboat?`<span>${icon('check')} ${b.licence_required===false?'No license required':'License required'}</span>`:''}${b.specifications?.pets_allowed===true?`<span>${icon('check')} Pets allowed</span>`:''}${hasSkipper?`<span>${icon('ship')} Skipper ${included?'included':'available'}</span>`:''}</div>`;
      const conditions=`<section class="listing-conditions"><h2>Conditions</h2><div class="listing-condition-grid"><div><h3>Check-in & check-out</h3><dl><div><dt>Day rental check-in</dt><dd>${esc(boatClock(b.check_in_time,'09:00'))}</dd></div><div><dt>Day rental check-out</dt><dd>${esc(boatClock(b.check_out_time,'19:00'))}</dd></div></dl></div><div><h3>Boat rules</h3><dl><div><dt>Boat licence required</dt><dd>${b.licence_required===false?'No':'Yes'}</dd></div><div><dt>Pets allowed</dt><dd>${b.specifications?.pets_allowed===true?'Yes':'No'}</dd></div><div><dt>Minimum rental age</dt><dd>${Math.max(18,Number(b.minimum_rental_age)||18)} years</dd></div></dl></div></div></section>`;
      const bookingBox=isOwner?`<div class="live-card listing-booking-card"><span class="listing-price-caption">Your payout</span><h2>${money(b.price)} <small>/ day</small></h2><p>Guest price: ${money(guestDailyRate(b.price))} per day, fees included.</p><div class="verification-booking-block"><strong>Owner preview</strong><p>Owner accounts cannot rent their own boats. Use a customer account to book.</p></div><a class="btn" href="#/owner?edit=${esc(b.id)}">Edit listing</a></div>`:
        `<form data-live-form="request" data-id="${esc(b.id)}" data-price="${b.price}" data-unavailable="${esc(JSON.stringify(unavailable.map(({start_date,end_date})=>({start_date,end_date}))))}" data-check-in="${esc(boatClock(b.check_in_time,'09:00'))}" data-check-out="${esc(boatClock(b.check_out_time,'19:00'))}" data-with-skipper="${hasSkipper}" data-without-skipper="${hasBareboat}" data-skipper-fee="${Number(b.skipper_fee_per_day)||0}" data-skipper-extra="${hasBareboat&&hasSkipper}" data-verified="${verificationState()==='approved'}" data-licence-required="${b.licence_required!==false}" data-licence-expiry="${esc(verificationRequest?.licence_expiry||'')}" class="live-card live-form listing-booking-card"><span class="listing-price-caption">From</span><h2>${money(guestDailyRate(b.price))} <small>/ day</small></h2><p class="member-note">Boat rental includes booking fees. Payment is processed after booking approval.<span data-optional-skipper-note ${hasSkipper&&hasBareboat&&mode==='with'?'':'hidden'}> Optional skipper fees are paid at check-in.</span></p>${choices}${bookingDateFields()}<input type="hidden" name="guests" value="1"><div data-quote aria-live="polite"></div>${warning}<button class="btn" type="submit" ${needsVerification?'disabled':''}>${needsVerification?'Verify your licence to book':session?'Request to book':'Log in to request'}</button><p data-feedback role="status"></p><small>The owner will confirm availability before you pay.</small></form>`;
      return page(esc(b.name),`<div class="listing-action-row"><button type="button" class="listing-action" data-live="share-listing" data-id="${esc(b.id)}" data-title="${esc(b.name)}" aria-label="Share this boat"><svg aria-hidden="true" class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 14v6h16v-6"/></svg> <span>Share</span></button><button type="button" class="listing-action ${savedFavourite?'is-saved':''}" data-live="${savedFavourite?'unfavourite':'favourite'}" data-id="${esc(b.id)}" aria-pressed="${savedFavourite}">${icon('heart')} <span>${savedFavourite?'Added to favorites':'Add to favorites'}</span></button></div><div class="listing-location-intro">${icon('pin')} ${esc(b.location)}, ${esc(b.country)} <span>·</span> ${esc(b.type)} <span>·</span> Up to ${Number(b.guests)||1} ${(Number(b.guests)||1)===1?'passenger':'passengers'}</div><div class="live-columns listing-layout"><section class="listing-details">${(()=>{const urls=[...new Set([...(b.photo_url?[b.photo_url]:[]),...(Array.isArray(b.photo_urls)?b.photo_urls:[])])].filter(photo).slice(0,15);return urls.length?`<div class="boat-photo-carousel" data-boat-gallery data-images="${esc(JSON.stringify(urls))}" style="position:relative;margin-bottom:18px"><div class="listing-cover" style="position:relative"><button type="button" data-gallery-open="0" aria-label="Open boat photo gallery" style="display:block;width:100%;padding:0;border:0;background:transparent;cursor:default"><img data-gallery-main src="${esc(urls[0])}" alt="${esc(b.name)} - boat photo 1" style="width:100%;max-height:510px;object-fit:cover;display:block"></button>${urls.length>1?`<button type="button" data-gallery-step="-1" aria-label="Previous photo" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);border:0;border-radius:50%;background:#fff;color:#18323d;width:42px;height:42px;font-size:26px;cursor:pointer">‹</button><button type="button" data-gallery-step="1" aria-label="Next photo" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);border:0;border-radius:50%;background:#fff;color:#18323d;width:42px;height:42px;font-size:26px;cursor:pointer">›</button>`:''}<span data-gallery-count style="position:absolute;right:15px;bottom:12px;background:#12333cdd;color:#fff;border-radius:20px;padding:5px 12px;font-size:13px">1 / ${urls.length}</span></div>${urls.length>1?`<div style="display:flex;gap:9px;overflow-x:auto;padding:10px 0">${urls.map((url,i)=>`<button type="button" data-gallery-select="${i}" aria-label="Show photo ${i+1}" aria-pressed="${i===0}" style="flex:none;padding:0;background:none;border:0;cursor:default"><img src="${esc(url)}" alt="Boat photo ${i+1}" loading="lazy" style="width:100px;height:76px;object-fit:cover;border-radius:9px"></button>`).join('')}</div>`:''}</div>`:`<div class="listing-cover">${picture(b)}</div>`})()}${rentalHighlights}<section class="listing-about"><h2>About this boat</h2><p class="live-description">${esc(b.description||'Ask the owner for more information about this boat.')}</p></section>${listingSpecificationSections(b)}${listingEquipmentSection(b)}${listingAvailabilityCalendar(unavailable,today().slice(0,7))}${conditions}${pickupDetails(b,exactPickup)}${listingOwnerReviews(reviews)}</section><aside class="listing-booking">${bookingBox}</aside></div>`);
    }
    const guard=requireAccount();if(guard)return guard;
    if(path==='/messages')return messagesPage(params.get('booking'));
    if(path==='/account')return page(profile?.account_type==='owner'?'Owner account':'Complete your profile',accountProfile(params.get('tab')||'information'));
    if(path==='/staff')return staffPage();
    if(path==='/reservations')return adminReservationsPage();
    if(path==='/dashboard'){
      if(profile.account_type==='owner'){
        const boats=check(await client.from('boats').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}));
        const requests=boats.length?check(await client.from('bookings').select('*,boats(name,check_in_time,check_out_time)').in('boat_id',boats.map(b=>b.id)).order('created_at',{ascending:false})):[];
        return page('Owner dashboard',ownerDashboardHome(boats,requests));
      }
      const rows=check(await client.from('bookings').select('*,boats(name,check_in_time,check_out_time)').eq('customer_id',session.user.id).order('created_at',{ascending:false}));
      return page('Dashboard',dashboardHome(rows,[]));
    }
    if(profile.account_type==='owner'&&['/favourites','/bookings'].includes(path))return page('Owner account',`<div class="profile-panel"><h2>Owner accounts cannot rent boats</h2><p>Your account is for listing boats and managing guests. To rent a boat, log out and create a separate customer account with a different email.</p><a class="btn" href="#/owner">Manage my boats</a></div>`);
    if(path==='/favourites'){
      const saved=check(await client.from('favourites').select('boat_id,boats(*)').eq('user_id',session.user.id));
      return page('Your favourites',saved.length?`<div class="live-grid">${saved.map(x=>`<article class="live-card">${x.boats?`${picture(x.boats)}<h2>${esc(x.boats.name)}</h2><a href="#/listing/${x.boat_id}">View boat</a>`:'<p>This boat is no longer available.</p>'}${btn('Remove','unfavourite',x.boat_id)}</article>`).join('')}</div>`:'<div class="member-empty"><p>Save the boats you love and find them here.</p><a href="#/boats">Explore boats →</a></div>');
    }
    if(path==='/bookings'){
      const bookings=check(await client.from('bookings').select('*,boats(name,owner_id,check_in_time,check_out_time)').eq('customer_id',session.user.id).order('created_at',{ascending:false}));
      const reviews=check(await client.from('owner_reviews').select('booking_id,rating,comment').eq('customer_id',session.user.id));
      return page('My bookings.',`<div class="customer-bookings-intro"><p>All your booking requests in one place.</p>${btn('Refresh','refresh')}</div>${customerBookings(bookings,reviews)}`);
    }
    if(profile.account_type!=='owner')return page('Customer account',`<div class="profile-panel"><h2>Only boat owners can list boats</h2><p>Your customer account is for browsing and renting boats. To list your own boats, log out and create a separate boat owner account with a different email address. Account roles cannot be changed after sign-up.</p>${btn('Log out and create owner account','logout-owner')}</div>`);
    const boats=check(await client.from('boats').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}));
    const editing=params.get('edit');if(editing){
      const boat=boats.find(b=>b.id===editing)||{};
      if(boat.id){
        const pickup=check(await client.from('boat_pickups').select('pickup_address,latitude,longitude').eq('boat_id',boat.id).maybeSingle());
        if(pickup)Object.assign(boat,{pickup_location:pickup.pickup_address,pickup_latitude:pickup.latitude,pickup_longitude:pickup.longitude});
      }
      return page('Edit boat',boatForm(boat));
    }
    const rows=boats.length?check(await client.from('bookings').select('*,boats(name,check_in_time,check_out_time)').in('boat_id',boats.map(b=>b.id)).order('created_at',{ascending:false})):[];
    if(params.get('view')==='requests')return page('Booking requests',ownerRequestsWorkspace(rows));
    const blocks=boats.length?check(await client.from('boat_blocks').select('*').in('boat_id',boats.map(b=>b.id)).order('start_date')):[];
    if(params.get('view')==='calendar')return page('Boat calendar',ownerCalendar(boats.find(b=>b.id===params.get('boat')),rows.filter(r=>r.boat_id===params.get('boat')),blocks.filter(b=>b.boat_id===params.get('boat')),params.get('month')));
    return page('My Boats',ownerFleet(boats,rows,['published','drafts'].includes(params.get('filter'))?params.get('filter'):'all',params.get('layout')||'grid'));
  }
  const routes=p=>['/boats','/owner','/bookings','/account','/login','/dashboard','/favourites','/staff','/messages'].includes(p)||p.startsWith('/listing/');
  window.liveRender=()=>{
    if(!authReady){app.innerHTML=accountLoading;return true;}
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
    const showAuth=path==='/login'||(!session&&['/owner','/bookings','/account','/dashboard','/favourites','/staff','/reservations','/messages'].includes(path));
    if(showAuth){if(!authBackground)authBackground=returnRoute==='#/'?home():app.innerHTML||home()}
    else{returnRoute=location.hash||'#/';authBackground=null;document.body?.classList.remove('auth-open')}
    if(!routes(path))return false;
    // Keep the same dialog while Auth initializes; do not flash a second login design.
    if(ownerPickupMap){ownerPickupMap.map.remove();ownerPickupMap=null;}
    if(publicPickupMap){publicPickupMap.remove();publicPickupMap=null;}
    app.innerHTML=showProfile?profileDialog(authNext):showAuth?loginPage():accountLoading;focusAuth();
    route().then(html=>{if(token!==epoch)return;app.innerHTML=html;quote();updateOwnerSkipperFee(document.querySelector('[data-live-form="boat"]'));syncEquipmentPicker(document.querySelector('[data-live-form="boat"]'));showOwnerBoatStep(document.querySelector('[data-live-form="boat"]'),restoredOwnerBoatStep());initOwnerPickupMap();initPublicPickupMap();syncCalendarSelection();focusAuth();syncChatSubscription();if(ownerScrollTarget){const target=ownerScrollTarget;ownerScrollTarget='';document.getElementById?.(target)?.scrollIntoView?.({block:'start',behavior:'instant'});}}).catch(e=>{if(token===epoch){app.innerHTML=page('We couldn’t load this page.',`<p role="alert">${errorText(e)}</p>${btn('Try again','refresh')}`);syncChatSubscription()}});return true;
  };
  function syncBookingSkipperOption(form){
    const checkbox=form?.querySelector('[data-needs-skipper]');
    const hidden=form?.querySelector('input[name="skipper"]');
    if(checkbox&&hidden)hidden.value=checkbox.checked?'with':'without';
    const note=form?.querySelector('[data-optional-skipper-note]');
    if(note)note.hidden=!(checkbox&&checkbox.checked);
  }
  function updateBookingVerification(form,d){
    const bareboat=d.get('skipper')==='without',expiry=form.dataset.licenceExpiry;
    const blocked=!!session&&bareboat&&form.dataset.licenceRequired!=='false'&&(form.dataset.verified!=='true'||!!(expiry&&d.get('end_date')>expiry));
    const warning=form.querySelector('[data-skipper-verification]'),button=form.querySelector('button[type="submit"]');
    if(warning)warning.hidden=!blocked;
    if(button){button.disabled=blocked;button.textContent=blocked?'Verification required':session?'Send booking request':'Log in to request';}
  }
  function quote(){const form=document.querySelector('[data-live-form="request"]');if(!form)return;syncBookingSkipperOption(form);const d=new FormData(form),n=rentalDayCount(d.get('start_date'),d.get('end_date'));updateBookingVerification(form,d);const out=form.querySelector('[data-quote]');if(!n||n<1){out.textContent='Choose a valid rental period.';return}const occupied=JSON.parse(form.dataset.unavailable||'[]').some(({start_date,end_date})=>start_date<=d.get('end_date')&&end_date>=d.get('start_date'));if(occupied){out.textContent='These dates are unavailable. Please choose another period.';const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;return}const charter=n*Number(form.dataset.price),total=guestTotal(charter),skipperExtra=d.get('skipper')==='with'&&form.dataset.skipperExtra==='true'?n*Number(form.dataset.skipperFee||0):0,tripTotal=total+skipperExtra;out.innerHTML=`<p>${n} ${n===1?'day':'days'} · ${esc(form.dataset.checkIn||'09:00')} check-in · ${esc(form.dataset.checkOut||'19:00')} check-out</p><p>Boat rental (booking fees included): <strong>${money(total)}</strong></p>${skipperExtra>0?`<p><strong>Total trip cost: ${money(tripTotal)}</strong></p>`:''}${skipperExtra>0?`<p class="fleet-quote-extra">Skipper: <strong>${money(skipperExtra)}</strong> · payable directly at check-in.</p>`:d.get('skipper')==='with'&&form.dataset.withoutSkipper==='false'?'<p class="fleet-quote-extra">Skipper included in the boat price.</p>':''}`;}
  function syncListingCalendarSelection(){
    const selection=listingCalendarSelection;
    if(!selection)return;
    const [start,end]=[selection.anchor,selection.end].sort();
    for(const day of document.querySelectorAll('[data-listing-date]')){
      const active=day.dataset.listingDate>=start&&day.dataset.listingDate<=end;
      day.classList.toggle('is-selected',active);
      day.setAttribute('aria-pressed',String(active));
    }
    const hint=document.querySelector('[data-listing-calendar-hint]');
    if(hint)hint.textContent=selection.awaitingSecond?`First day: ${euroDate(selection.anchor)} Now choose the last day.`:`Selected ${euroRange(start,end)} Dates updated in the booking form.`;
  }
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
  // Browser number inputs normally allow scientific notation (e/E); boat specs use plain numbers only.
  const isBoatSpecNumber=target=>target?.matches?.('input[type="number"]')&&!!target.closest?.('[data-live-form="boat"] .fleet-optional-panel');
  const isWholeBoatSpec=target=>isBoatSpecNumber(target)&&['spec_engine_hp','spec_build_year','spec_tank_capacity_l','spec_cabins','spec_berths','guests'].includes(target.name);
  document.addEventListener('keydown',event=>{
    if(isBoatSpecNumber(event.target)&&(['e','E','+','-'].includes(event.key)||(isWholeBoatSpec(event.target)&&['.',','].includes(event.key))))event.preventDefault();
  });
  document.addEventListener('beforeinput',event=>{
    if(isBoatSpecNumber(event.target)&&event.data&&(/[eE+\-]/.test(event.data)||(isWholeBoatSpec(event.target)&&/[.,]/.test(event.data))))event.preventDefault();
  });
  document.addEventListener('input',e=>{
    if(isWholeBoatSpec(e.target)&&/[.,]/.test(e.target.value))e.target.value=e.target.value.split(/[.,]/)[0];
    if(e.target.matches?.('[data-equipment-search]'))syncEquipmentPicker(e.target.closest('[data-live-form="boat"]'));
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
      if(preview)preview.innerHTML=`Guest price: <strong>${money(guestDailyRate(Number(e.target.value)||0))} for 1 day</strong> · fees included.`;
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.closest('[data-live-form="request"]'))quote();
    const ownerBusiness=e.target.closest('[data-live-form="owner-business"]');
    if(ownerBusiness&&e.target.name==='business_country')syncOwnerBusinessCountry(ownerBusiness);
    const ownerBank=e.target.closest('[data-live-form="owner-payouts"]');
    if(ownerBank&&e.target.name==='bank_country')syncOwnerBankCountry(ownerBank);
    const boat=e.target.closest('[data-live-form="boat"]');
    if(boat)updateOwnerSkipperFee(boat);
    if(boat&&e.target.matches?.('input[name="equipment"]'))syncEquipmentPicker(boat);
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
  document.addEventListener('click',e=>{const button=e.target.closest?.('[data-rental-guest-step]');if(!button)return;const field=button.parentElement.querySelector('input[name="guests"]');field.value=String(Math.max(1,Math.min(100,Number(field.value||1)+Number(button.dataset.rentalGuestStep))));button.parentElement.querySelectorAll('button').forEach(b=>b.disabled=Number(field.value)<=1&&Number(b.dataset.rentalGuestStep)<0||Number(field.value)>=100&&Number(b.dataset.rentalGuestStep)>0);field.form?.requestSubmit();});
  document.addEventListener('input',e=>{const slider=e.target.closest?.('[data-rental-length]');if(!slider)return;const min=slider.querySelector('[name="min_length"]'),max=slider.querySelector('[name="max_length"]');if(e.target===min&&Number(min.value)>Number(max.value))max.value=min.value;if(e.target===max&&Number(max.value)<Number(min.value))min.value=max.value;const a=Number(min.value),b=Number(max.value);slider.querySelector('.rental-slider-active').style.left=(a/15*100)+'%';slider.querySelector('.rental-slider-active').style.right=(100-b/15*100)+'%';slider.parentElement.querySelector('[data-length-summary]').textContent=a+' - '+(b===15?'15+':b)+' m';});
  document.addEventListener('click',e=>{const button=e.target.closest?.('[data-rental-step]');if(!button)return;const [name,delta]=button.dataset.rentalStep.split(':');const field=button.parentElement.querySelector('[name="'+name+'"]');field.value=String(Math.max(0,Math.min(100,Number(field.value||0)+Number(delta))));button.parentElement.querySelectorAll('button').forEach(b=>b.disabled=Number(field.value)<=0&&b.dataset.rentalStep.endsWith(':-1')||Number(field.value)>=100&&b.dataset.rentalStep.endsWith(':1'));field.form?.requestSubmit();});
  document.addEventListener('input',e=>{const slider=e.target.closest?.('[data-rental-range="engine"]');if(!slider)return;const min=slider.querySelector('[name="engine_min"]'),max=slider.querySelector('[name="engine_max"]');if(e.target===min&&Number(min.value)>Number(max.value))max.value=min.value;if(e.target===max&&Number(max.value)<Number(min.value))min.value=max.value;const a=Number(min.value),b=Number(max.value);slider.querySelector('.rental-slider-active').style.left=(a/400*100)+'%';slider.querySelector('.rental-slider-active').style.right=(100-b/400*100)+'%';slider.parentElement.querySelector('[data-range-summary]').textContent=a+' - '+(b===400?'400+':b)+' hp';});
  document.addEventListener('input',e=>{const slider=e.target.closest?.('[data-rental-range="year"]');if(!slider)return;const min=slider.querySelector('[name="year_min"]'),max=slider.querySelector('[name="year_max"]');if(e.target===min&&Number(min.value)>Number(max.value))max.value=min.value;if(e.target===max&&Number(max.value)<Number(min.value))min.value=max.value;const a=Number(min.value),b=Number(max.value);slider.querySelector('.rental-slider-active').style.left=((a-2006)/20*100)+'%';slider.querySelector('.rental-slider-active').style.right=((2026-b)/20*100)+'%';slider.parentElement.querySelector('[data-year-summary]').textContent=a+' - '+b;});
  document.addEventListener('input',e=>{const slider=e.target.closest?.('[data-rental-range="price"]')||e.target.closest?.('.rental-price-section')?.querySelector('[data-rental-range="price"]');if(!slider)return;const section=slider.closest('.rental-price-section'),left=slider.querySelector('[name="price_slider_min"]'),right=slider.querySelector('[name="price_slider_max"]'),minInput=section.querySelector('[name="min_price"]'),maxInput=section.querySelector('[name="max_price"]');if(e.target===left){if(Number(left.value)>Number(right.value))right.value=left.value;minInput.value=left.value;}if(e.target===right){if(Number(right.value)<Number(left.value))left.value=right.value;minInput.value=left.value;maxInput.value=Number(right.value)===1200?'':right.value;}if(e.target===minInput){left.value=Math.min(1200,Math.max(0,Number(minInput.value)||0));if(Number(left.value)>Number(right.value))right.value=left.value;}if(e.target===maxInput){right.value=Math.min(1200,Math.max(0,Number(maxInput.value)||1200));if(Number(right.value)<Number(left.value))left.value=right.value;}slider.querySelector('.rental-slider-active').style.left=Number(left.value)/12+'%';slider.querySelector('.rental-slider-active').style.right=(100-Number(right.value)/12)+'%';});
  let searchRefreshId=0;
  document.addEventListener('submit',async e=>{const f=e.target;if(!f.dataset.liveForm)return;e.preventDefault();syncBookingSkipperOption(f);const button=f.querySelector('button[type="submit"],button:not([type])');if(button?.disabled&&f.dataset.liveForm!=='search')return;if(button&&f.dataset.liveForm!=='search')button.disabled=true;const feedback=f.querySelector('[data-feedback]');if(feedback)feedback.textContent='Saving…';try{if(!client)throw Error('Connecting your account. Please try again in a moment.');const d=new FormData(f),kind=f.dataset.liveForm;
    if(kind==='search'){
      const q=new URLSearchParams();
      for(const key of ['location','start','end','skipper','licence_not_required','with_skipper_only','guests','cabins','berths','min_price','max_price','min_length','max_length','engine_min','engine_max','year_min','year_max','country','sort','layout']){
        const value=String(d.get(key)||'').trim();if(value)q.set(key,value);
      }
      for(const key of ['type','equipment'])for(const value of d.getAll(key))if(value)q.append(key,String(value));
      const nextHash='#/boats?'+q.toString();
      const results=f.querySelector('.rental-results');
      if(!results){location.hash=nextHash;return;}
      const requestId=++searchRefreshId,renderEpoch=epoch;
      history.replaceState(history.state,'',location.pathname+location.search+nextHash);
      results.setAttribute('aria-busy','true');
      try{
        const html=await route();
        if(requestId!==searchRefreshId||renderEpoch!==epoch||!f.isConnected||parseRoute().path!=='/boats')return;
        const container=document.createElement('div');container.innerHTML=html||'';
        const fresh=container.querySelector('.rental-results');
        if(!fresh)throw Error('Could not refresh boat results.');
        results.innerHTML=fresh.innerHTML;
      }finally{
        if(requestId===searchRefreshId&&f.isConnected)results.removeAttribute('aria-busy');
      }
      return;
    }
    if(kind==='auth'&&!recovery&&authMode!=='signup'&&authStep==='email'){authEmail=String(d.get('email')||'').trim();authStep='password';render();return}
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
      const details={...(profile.details||{})}, keys=f.dataset.section==='experience'?['boating_level','boat_preference','bio']:['first_name','last_name','birth_date','languages','address','postal_code','city'];
      for(const key of keys)details[key]=String(d.get(key)||'').trim();
      if(f.dataset.section==='information'){
        const code=String(d.get('phone_code')||'').trim(),rawLocal=String(d.get('phone_local')||'').trim();
        const legacyPhone=String(d.get('phone')||'').trim();
        if(rawLocal){
          if(!code)throw Error('Choose a country code before entering your phone number.');
          if(!profilePhoneCodes.some(([,dial])=>dial===code))throw Error('Choose a valid telephone country code.');
          const local=rawLocal.startsWith(code)?rawLocal.slice(code.length).trim():rawLocal;
          if(!/^[0-9(). -]{4,36}$/.test(local)||(local.match(/[0-9]/g)||[]).length<4)throw Error('Enter a valid telephone number.');
          details.phone=`${code} ${local}`;
        }else details.phone=legacyPhone;
      }
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
        if(!ownerCountryOptions.some(([value])=>value===country))throw Error('Choose a valid business registration country.');
        const legalName=String(d.get('legal_business_name')||'').trim(),tax=String(d.get('tax_identifier')||'').trim();
        const websiteInput=String(d.get('business_website')||'').trim(),website=/^https?:\/\//i.test(websiteInput)?websiteInput:`https://${websiteInput}`,address=String(d.get('registered_address')||'').trim();
        if(legalName.length<2||legalName.length>180||address.length<6)throw Error('Enter your registered company name and address.');
        if(country==='FR'&&!/^\d{14}$/.test(tax))throw Error('A French SIRET must contain 14 digits.');
        if(country==='HR'&&!/^\d{11}$/.test(tax))throw Error('A Croatian OIB must contain 11 digits.');
        if(tax.length<3||tax.length>80)throw Error('Enter a valid business registration number.');
        let websiteValid=false;try{const parsed=new URL(website);websiteValid=/^https?:$/.test(parsed.protocol)&&/^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(parsed.hostname)&&!parsed.username&&!parsed.password&&!/\s/.test(websiteInput);}catch{}if(!websiteValid||website.length>300)throw Error('Enter a valid business website, such as www.yourcompany.com.');
        const changed=await save({business_country:country,legal_business_name:legalName,tax_identifier:tax,registered_address:address,business_website:website});
        toast(changed?'Business information saved.':'Business information is already up to date.');return;
      }
      if(kind==='owner-payouts'){
        const bankCountry=String(d.get('bank_country')||String(d.get('iban')||'').slice(0,2)).toUpperCase();
        if(!ownerBankCountries.some(([code])=>code===bankCountry))throw Error('Choose the country where your business bank account is held.');
        const ibanHolder=String(d.get('iban_holder')||'').trim();
        if(ibanHolder.length<2||ibanHolder.length>180)throw Error('Enter the legal name of the business account holder.');
        if(ownerLocalBankCountries.includes(bankCountry)){
          const accountNumber=String(d.get('account_number')||'').replace(/\s+/g,'').trim();
          const routingNumber=String(d.get('routing_number')||'').replace(/[\s-]/g,'').trim().toUpperCase();
          const swiftBic=String(d.get('swift_bic')||'').replace(/\s+/g,'').trim().toUpperCase();
          if(!/^[A-Za-z0-9-]{4,34}$/.test(accountNumber))throw Error('Enter a valid business bank account number.');
          if(bankCountry==='US'&&!/^[0-9]{9}$/.test(routingNumber))throw Error('Enter the 9-digit ABA routing number.');
          if(bankCountry==='AU'&&!/^[0-9]{6}$/.test(routingNumber))throw Error('Enter the 6-digit BSB.');
          if(bankCountry==='BS'&&!/^[A-Z0-9-]{2,80}$/.test(routingNumber))throw Error('Enter your bank / branch code.');
          if(swiftBic&&!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftBic))throw Error('SWIFT / BIC must be 8 or 11 letters and numbers.');
          if(bankCountry==='BS'&&!swiftBic)throw Error('Enter the SWIFT / BIC for your Bahamas business bank account.');
          const changed=await save({iban:null,iban_holder:ibanHolder,payout_bank_details:{country:bankCountry,method:'local',account_number:accountNumber,routing_number:routingNumber,swift_bic:swiftBic}});
          toast(changed?'Business bank account saved.':'Business bank account is already up to date.');return;
        }
        const iban=String(d.get('iban')||'').replace(/\s+/g,'').toUpperCase();
        if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban))throw Error('Enter a valid business IBAN.');
        if(iban.slice(0,2)!==bankCountry)throw Error('The IBAN country code must match the selected bank country.');
        const changed=await save({iban,iban_holder:ibanHolder,payout_bank_details:{country:bankCountry,method:'iban'}});
        toast(changed?'Business bank account saved.':'Business bank account is already up to date.');return;
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
      check(await client.from('owner_verification_requests').update({application_state:'submitted',submitted_at:new Date().toISOString()}).eq('user_id',session.user.id).select().single());
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
      let emailNotice='';
      if(decision==='approved'){
        try{
          const {data:notice,error:emailError}=await client.functions.invoke('verification-approved-email',{body:{user_id:f.dataset.id}});
          if(emailError||!notice?.sent)throw emailError||new Error(notice?.error||'Email not sent');
          emailNotice=' Verification confirmation email sent.';
        }catch(error){
          console.warn('Verification confirmation email pending:',error?.message||error);
          emailNotice=' Verification saved, but email delivery needs a retry.';
        }
      }
      await current();render();toast((cleanup.error?'Decision saved. Document cleanup needs staff attention.':'Decision saved. Document copies removed from private storage.')+emailNotice);return;
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
    if(kind==='password'){
      const password=String(d.get('password')||'');
      if(password.length<10)throw Error('Use at least 10 characters.');
      if(password!==d.get('confirm'))throw Error('The passwords do not match.');
      check(await client.auth.updateUser({password}));
      f.reset();
      feedback.textContent='Password updated. Sending security confirmation…';
      try{
        const {data:notice,error:notificationError}=await client.functions.invoke('password-changed-email',{body:{}});
        if(notificationError||!notice?.sent)throw notificationError||new Error(notice?.error||'Email not sent');
        feedback.textContent='Password updated. A confirmation email has been sent to your registered address.';
      }catch(error){
        console.warn('Password confirmation notification failed:',error?.message||error);
        feedback.textContent='Password updated, but the confirmation email could not be sent. Your new password is active.';
      }
      return;
    }
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
      const skipperFee=withSkipper&&withoutSkipper?Number(d.get('skipper_fee_per_day')):0;
      if(!Number.isFinite(skipperFee)||(withSkipper&&withoutSkipper&&skipperFee<=0)||skipperFee<0||skipperFee>10000)throw Error('Enter a skipper price per day greater than €0 (maximum €10,000).');
      const specNames=['cabins','berths','engine_hp','length_m','width_m','draft_m','build_year','tank_capacity_l','fuel_lph','speed_knots','crew'];
      const mandatorySpecs=['engine_hp','length_m','build_year','tank_capacity_l','fuel_lph'];
      if(mandatorySpecs.some(name=>String(d.get('spec_'+name)||'').trim()===''))throw Error('Complete the required technical specifications. Boat width and draft are optional.');
      const specs={};
      for(const name of specNames){
        const raw=String(d.get('spec_'+name)||'').trim();
        if(!raw)continue;
        const number=Number(raw);
        if(!Number.isFinite(number)||number<0||number>50000)throw Error('Check the technical specification values.');
        if(['engine_hp','build_year','tank_capacity_l','cabins','berths'].includes(name)&&!Number.isInteger(number))throw Error('Horsepower, year, tank capacity, cabins and berths must be whole numbers.');
        if(name==='build_year'&&(!Number.isInteger(number)||number<1850||number>2100))throw Error('Year built must be a four-digit year between 1850 and 2100.');
        specs[name]=number;
      }
      const engineType=String(d.get('spec_engine_type')||'');
      if(!['','outboard','inboard','electric','none','other'].includes(engineType))throw Error('Choose valid technical specification options.');
      if(!engineType)throw Error('Choose an engine type.');
      if(engineType)specs.engine_type=engineType;
      const selectedEquipment=d.getAll?.('equipment')||[];
      if(!Array.isArray(selectedEquipment)||selectedEquipment.some(id=>!allowedEquipment.has(id)))throw Error('Please choose equipment from the available list.');
      specs.equipment=[...new Set(selectedEquipment)];
      const petsAllowed=String(d.get('pets_allowed')||'false');
      if(!['true','false'].includes(petsAllowed))throw Error('Choose Yes or No for pets allowed.');
      specs.pets_allowed=petsAllowed==='true';
      const insuranceType=String(d.get('insurance_type')||'not_specified');
      if(!['not_specified','none','third_party','comprehensive'].includes(insuranceType))throw Error('Choose a valid insurance type.');
      const deposit=Number(d.get('security_deposit')||0);
      if(!Number.isFinite(deposit)||deposit<0||deposit>100000)throw Error('Enter a refundable security deposit between €0 and €100,000.');
      const originalBoat=f.dataset.id?check(await client.from('boats').select('photo_url,photo_urls').eq('id',f.dataset.id).single()):null;
      const existingPhotos=[...new Set([...(Array.isArray(originalBoat?.photo_urls)?originalBoat.photo_urls:[]),...(originalBoat?.photo_url?[originalBoat.photo_url]:[])])].filter(photo);
      const removed=new Set(d.getAll('remove_photo').map(String));
      const orderedPhotoUrls=Array.from(f.querySelectorAll('.fleet-photo-card[data-photo-url]')).map(card=>card.dataset.photoUrl);const retainedPhotos=[...new Set([...orderedPhotoUrls,...existingPhotos])].filter(url=>existingPhotos.includes(url)&&!removed.has(url));
      const newFiles=Array.from(f.querySelector('[name="photos"]')?.files||[]);
      if(retainedPhotos.length+newFiles.length>15)throw Error('A listing can have a maximum of 15 photos. Remove existing photos or select fewer files.');
      for(const file of newFiles)if(file.size>5242880||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Each photo must be JPEG, PNG or WebP under 5 MB.');
      const uploadedPhotos=[];
      for(const file of newFiles){const key=`${session.user.id}/${crypto.randomUUID()}.${{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]}`;check(await client.storage.from('boat-photos').upload(key,file,{contentType:file.type,upsert:false}));uploadedPhotos.push(client.storage.from('boat-photos').getPublicUrl(key).data.publicUrl);}
      const photoUrls=[...retainedPhotos,...uploadedPhotos];const imageUrl=photoUrls[0]||null;
      const pickupLocation=String(d.get('pickup_location')||d.get('location')||'').trim();
      if(!pickupLocation||pickupLocation.length>240)throw Error('Enter a pickup address of up to 240 characters.');
      const rawLatitude=String(d.get('pickup_latitude')||'').trim(),rawLongitude=String(d.get('pickup_longitude')||'').trim();
      if(Boolean(rawLatitude)!==Boolean(rawLongitude))throw Error('Set both latitude and longitude, or leave both blank.');
      const pickupLatitude=rawLatitude?Number(rawLatitude):null,pickupLongitude=rawLongitude?Number(rawLongitude):null;
      if(rawLatitude&&!validPickupCoordinates(pickupLatitude,pickupLongitude))throw Error('The pickup pin coordinates are outside the valid map range.');
      const checkInTime=String(d.get('check_in_time')||'09:00').trim();
      const checkOutTime=String(d.get('check_out_time')||'19:00').trim();
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(checkInTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(checkOutTime))throw Error('Enter valid check-in and check-out times.');
      const licenceRequired=d.get('licence_required')!=='false';
      const minimumAge=Number(d.get('minimum_rental_age')||18);
      if(!Number.isInteger(minimumAge)||minimumAge<18||minimumAge>100)throw Error('Enter a minimum rental age between 18 and 100.');
      if(!String(d.get('guests')||'').trim()||!Number.isInteger(Number(d.get('guests')))||Number(d.get('guests'))<1||Number(d.get('guests'))>100)throw Error('Number of people is required (1–100).');
      const value={owner_id:session.user.id,name:String(d.get('name')).trim(),country,location:String(d.get('location')).trim(),check_in_time:checkInTime,check_out_time:checkOutTime,licence_required:licenceRequired,minimum_rental_age:minimumAge,type:d.get('type'),price:Number(d.get('price')),guests:Number(d.get('guests'))||1,description:d.get('description'),published:d.get('published')==='on',with_skipper:withSkipper,without_skipper:withoutSkipper,skipper_fee_per_day:skipperFee,specifications:specs,insurance_type:insuranceType,security_deposit:deposit,photo_url:imageUrl,photo_urls:photoUrls};
      const saved=check(await(f.dataset.id?client.from('boats').update(value).eq('id',f.dataset.id).select().single():client.from('boats').insert(value).select().single()));
      check(await client.from('boat_pickups').upsert({boat_id:saved.id,pickup_address:pickupLocation,latitude:pickupLatitude,longitude:pickupLongitude},{onConflict:'boat_id'}).select().single());
      location.hash='#/owner';render();return;
    }
    if(kind==='guest-owner-review'){
      if(profile?.account_type!=='customer')throw Error('Only guests can review boat owners.');
      const rating=Number(d.get('rating')),comment=String(d.get('comment')||'').trim();
      if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Choose a rating from 1 to 5 stars.');
      if(comment.length>1500)throw Error('Please keep your review under 1,500 characters.');
      check(await client.from('owner_reviews').insert({booking_id:f.dataset.id,boat_id:f.dataset.boat,owner_id:f.dataset.owner,customer_id:session.user.id,rating,comment}));
      toast('Thank you! Your owner review is now published.');render();return;
    }
    if(kind==='request'){
      if(profile?.account_type!=='customer')throw Error('Owner accounts cannot rent boats. Use a separate customer account.');
      const mode=d.get('skipper');if(!['with','without'].includes(mode))throw Error('Choose a rental option.');
      if((mode==='with'&&f.dataset.withSkipper==='false')||(mode==='without'&&f.dataset.withoutSkipper==='false'))throw Error('This boat does not offer the selected rental option.');
      if(!hasProfileName(profile)){
        const query=new URLSearchParams({start:String(d.get('start_date')||''),end:String(d.get('end_date')||''),guests:String(d.get('guests')||1),skipper:mode});location.hash=setupLink('#/listing/'+f.dataset.id+'?'+query.toString());return;
      }
      if(mode==='without'&&f.dataset.licenceRequired!=='false'&&verificationState()!=='approved'){location.hash='#/account?tab=verification';render();toast('ID and boat driving licence verification is required to rent without a skipper.');return;}
      const start=d.get('start_date'),end=d.get('end_date');if(end<start)throw Error('Last day must be on or after the first day.');
      if(mode==='without'&&f.dataset.licenceRequired!=='false'&&verificationRequest?.licence_expiry&&end>verificationRequest.licence_expiry)throw Error('Your boat licence must remain valid through the last rental day.');
      const booking=check(await client.from('bookings').insert({boat_id:f.dataset.id,customer_id:session.user.id,customer_name:profile.display_name,start_date:start,end_date:end,guests:Number(d.get('guests')),with_skipper:mode==='with'}).select().single());
      toast('Request sent to the owner. You can message them now.');location.hash='#/messages?booking='+booking.id;notifyBookingEmail('booking_created',booking.id);return;
    }
    if(kind==='special-offer'){if(!session)throw Error('Please sign in.');const price=Number(d.get('charter_price')),extras=Number(d.get('extras_on_site')||0),days=Number(d.get('validity_days'));if(!Number.isFinite(price)||price<1||price>1000000||!Number.isFinite(extras)||extras<0||extras>100000||![1,3,7,14].includes(days))throw Error('Enter a valid offer price, extras and validity period.');const offer=check(await client.from('booking_offers').insert({booking_id:f.dataset.id,owner_id:session.user.id,charter_price:price,extras_on_site:extras,expires_at:new Date(Date.now()+days*86400000).toISOString()}).select().single());render();toast('Special offer sent.');return}
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
  const formatRentalDate=value=>{const [y,m,d]=String(value||'').split('-');return y&&m&&d?d+'/'+m+'/'+y:'dd/mm/yyyy';};
  let rentalCalendarMonth=null;
  const rentalCalendarISO=(y,m,d)=>y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  function closeRentalCalendar(){document.querySelector('[data-rental-calendar]')?.remove();}
  function openRentalCalendar(trigger){
    closeRentalCalendar();
    const field=trigger.dataset.rentalDateOpen,form=trigger.closest('form'),input=form?.querySelector('input[name="'+field+'"]');
    if(!input)return;
    const now=new Date(),todayISO=rentalCalendarISO(now.getFullYear(),now.getMonth(),now.getDate());
    const chosen=input.value||form.querySelector('input[name="start"]')?.value||todayISO;
    rentalCalendarMonth=rentalCalendarMonth&&trigger.dataset.rentalCalendarMonth==='keep'?rentalCalendarMonth:chosen.slice(0,7);
    const [year,month]=rentalCalendarMonth.split('-').map(Number);
    const first=new Date(year,month-1,1),days=new Date(year,month,0).getDate(),offset=(first.getDay()+6)%7;
    const minDate=field==='end'?(form.querySelector('input[name="start"]')?.value||todayISO):todayISO;
    const grid=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{
      const day=i-offset+1;if(day<1||day>days)return '<span class="rental-cal-blank"></span>';
      const value=rentalCalendarISO(year,month-1,day);
      return '<button type="button" class="rental-cal-day '+(value===input.value?'is-selected ':'')+(value===todayISO?'is-today':'')+'" data-rental-date-value="'+value+'" '+(value<minDate?'disabled':'')+'>'+day+'</button>';
    }).join('');
    const calendar=document.createElement('div');calendar.className='rental-calendar-popover';calendar.dataset.rentalCalendar=field;
    calendar.innerHTML='<div class="rental-cal-head"><strong>'+first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</strong><div><button type="button" data-rental-cal-nav="-1" aria-label="Previous month">‹</button><button type="button" data-rental-cal-nav="1" aria-label="Next month">›</button></div></div><div class="rental-cal-weekdays">'+['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="rental-cal-grid">'+grid+'</div><div class="rental-cal-foot"><button type="button" data-rental-cal-today>Today</button><button type="button" data-rental-cal-clear>Clear</button></div>';
    document.body.appendChild(calendar);
    const rect=trigger.getBoundingClientRect(),width=calendar.offsetWidth;
    calendar.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';
    calendar.style.top=(rect.bottom+calendar.offsetHeight+8<innerHeight?rect.bottom+8:Math.max(8,rect.top-calendar.offsetHeight-8))+'px';
    calendar._trigger=trigger;
  }
  function selectedProfileLanguages(picker){return String(picker?.querySelector('input[name="languages"]')?.value||'').split(',').map(v=>v.trim()).filter(Boolean);}
  function refreshProfileLanguagePicker(picker){
    if(!picker)return;
    const selected=selectedProfileLanguages(picker),summary=picker.querySelector('[data-language-summary]'),count=picker.querySelector('[data-language-count]');
    summary.textContent=selected.length?selected.slice(0,4).join(', ')+(selected.length>4?' +'+(selected.length-4):''):'Choose your languages';
    if(count){count.hidden=!selected.length;count.textContent=selected.length+' selected';}
    const picked=picker.querySelector('[data-language-picked]');if(picked)picked.textContent=selected.length+' selected';
    const list=picker.querySelector('[data-profile-language-suggestions]'),search=picker.querySelector('.profile-language-search');
    if(!list)return;
    const query=(search?.value||'').trim().toLowerCase();
    const results=profileLanguageOptions.filter(name=>name.toLowerCase().includes(query));
    list.replaceChildren();
    for(const name of results){
      const checked=selected.some(value=>value.toLowerCase()===name.toLowerCase());
      const button=document.createElement('button');button.type='button';button.className='language-selector-option'+(checked?' is-selected':'');button.dataset.languageChoice=name;button.setAttribute('aria-pressed',String(checked));
      const mark=document.createElement('span');mark.className='language-selector-check';mark.textContent=checked?'✓':'';
      const label=document.createElement('span');label.textContent=name;
      button.append(mark,label);list.append(button);
    }
  }
  function toggleProfileLanguagePicker(picker,show){
    for(const other of document.querySelectorAll('[data-profile-language-picker]')){
      const open=other===picker&&show;other.querySelector('[data-language-popover]').hidden=!open;other.querySelector('[data-language-toggle]').setAttribute('aria-expanded',String(open));
    }
    if(show){const search=picker.querySelector('.profile-language-search');search.value='';refreshProfileLanguagePicker(picker);search.focus();}
  }
  document.addEventListener('click',event=>{
    const toggle=event.target.closest?.('[data-language-toggle]');
    if(toggle){event.preventDefault();const picker=toggle.closest('[data-profile-language-picker]');toggleProfileLanguagePicker(picker,picker.querySelector('[data-language-popover]').hidden);return;}
    const choice=event.target.closest?.('[data-language-choice]');
    if(choice){
      event.preventDefault();
      const picker=choice.closest('[data-profile-language-picker]'),selected=selectedProfileLanguages(picker),name=choice.dataset.languageChoice;
      const next=selected.some(value=>value.toLowerCase()===name.toLowerCase())?selected.filter(value=>value.toLowerCase()!==name.toLowerCase()):[...selected,name];
      picker.querySelector('input[name="languages"]').value=next.join(', ');const search=picker.querySelector('.profile-language-search');if(search)search.value='';refreshProfileLanguagePicker(picker);search?.focus();return;
    }
    const clear=event.target.closest?.('[data-language-clear]');
    if(clear){event.preventDefault();const picker=clear.closest('[data-profile-language-picker]');picker.querySelector('input[name="languages"]').value='';refreshProfileLanguagePicker(picker);return;}
    const done=event.target.closest?.('[data-language-done]');
    if(done){event.preventDefault();toggleProfileLanguagePicker(done.closest('[data-profile-language-picker]'),false);return;}
    if(!event.target.closest?.('[data-profile-language-picker]'))toggleProfileLanguagePicker(null,false);
  });
  document.addEventListener('input',event=>{if(event.target.matches?.('.profile-language-search'))refreshProfileLanguagePicker(event.target.closest('[data-profile-language-picker]'));});
  document.addEventListener('keydown',event=>{
    if(!event.target.closest?.('[data-profile-language-picker]'))return;
    if(event.key==='Escape'){toggleProfileLanguagePicker(null,false);return;}
    if(event.key==='Enter'&&event.target.matches?.('.profile-language-search')){
      event.preventDefault();const picker=event.target.closest('[data-profile-language-picker]'),first=picker.querySelector('[data-language-choice]');if(first)first.click();
    }
  });
  // Date of birth uses the same styled calendar as search, with quick month/year selection.
  function closeProfileBirthCalendar(){document.querySelector('[data-profile-birth-calendar]')?.remove();}
  function openProfileBirthCalendar(trigger,yearMonth){
    closeProfileBirthCalendar();
    const fieldName=trigger.dataset.profileBirthOpen;const input=trigger.closest('form')?.querySelector('input[name="'+fieldName+'"]');
    if(!input)return;
    const todayDate=new Date(),isExpiry=fieldName==='licence_expiry',maxYear=todayDate.getFullYear(),lastYear=isExpiry?maxYear+50:maxYear;
    const initial=input.value||(isExpiry?today():String(maxYear-25)+'-01-01');
    const [year,month]=String(yearMonth||initial.slice(0,7)).split('-').map(Number);
    const first=new Date(year,month-1,1),days=new Date(year,month,0).getDate(),offset=(first.getDay()+6)%7;
    const monthOptions=Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===month?'selected':'')+'>'+new Date(2000,i,1).toLocaleDateString('en-GB',{month:'long'})+'</option>').join('');
    const yearOptions=Array.from({length:lastYear-1899},(_,i)=>lastYear-i).map(y=>'<button type="button" role="option" aria-selected="'+(y===year)+'" class="profile-birth-year-option '+(y===year?'is-selected':'')+'" data-profile-birth-year-choice="'+y+'">'+y+'</button>').join('');
    const grid=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>{
      const d=i-offset+1;if(d<1||d>days)return '<span class="rental-cal-blank"></span>';
      const value=rentalCalendarISO(year,month-1,d);
      return '<button type="button" class="rental-cal-day '+(value===input.value?'is-selected':'')+'" data-profile-birth-day="'+value+'" '+(isExpiry?value<today()? 'disabled':'':value>today()?'disabled':'')+'>'+d+'</button>';
    }).join('');
    const popup=document.createElement('div');popup.className='rental-calendar-popover profile-birth-calendar';popup.dataset.profileBirthCalendar='';
    popup.innerHTML='<div class="rental-cal-head"><div class="profile-birth-month-year"><select data-profile-birth-month aria-label="Month">'+monthOptions+'</select><details class="profile-birth-year-picker"><summary aria-label="Choose year" aria-haspopup="listbox">'+year+'</summary><div class="profile-birth-year-list" role="listbox" aria-label="Year">'+yearOptions+'</div></details></div><div><button type="button" data-profile-birth-nav="-1" aria-label="Previous month">‹</button><button type="button" data-profile-birth-nav="1" aria-label="Next month">›</button></div></div><div class="rental-cal-weekdays">'+['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="rental-cal-grid">'+grid+'</div><div class="rental-cal-foot"><button type="button" data-profile-birth-today>Today</button><button type="button" data-profile-birth-clear>Clear</button></div>';
    document.body.appendChild(popup);
    const rect=trigger.getBoundingClientRect();
    popup.style.left=Math.max(12,Math.min(rect.left,innerWidth-popup.offsetWidth-12))+'px';
    popup.style.top=(rect.bottom+popup.offsetHeight+8<innerHeight?rect.bottom+8:Math.max(8,rect.top-popup.offsetHeight-8))+'px';
    popup._trigger=trigger;popup._year=year;popup._month=month;
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-profile-birth-open]');
    if(trigger){event.preventDefault();openProfileBirthCalendar(trigger);return;}
    const popup=event.target.closest?.('[data-profile-birth-calendar]');
    if(!popup){closeProfileBirthCalendar();return;}
    const yearChoice=event.target.closest?.('[data-profile-birth-year-choice]');
    if(yearChoice){
      const month=Number(popup.querySelector('[data-profile-birth-month]').value);
      openProfileBirthCalendar(popup._trigger,rentalCalendarISO(Number(yearChoice.dataset.profileBirthYearChoice),month-1,1).slice(0,7));
      return;
    }
    if(event.target.closest?.('.profile-birth-year-picker > summary')){
      requestAnimationFrame(()=>popup.querySelector('.profile-birth-year-option.is-selected')?.scrollIntoView({block:'center',inline:'nearest'}));
      return;
    }
    const nav=event.target.closest?.('[data-profile-birth-nav]');
    if(nav){const d=new Date(popup._year,popup._month-1+Number(nav.dataset.profileBirthNav),1);if(d.getFullYear()>=1900&&d.getFullYear()<=(popup._trigger.dataset.profileBirthOpen==='licence_expiry'?new Date().getFullYear()+50:new Date().getFullYear()))openProfileBirthCalendar(popup._trigger,rentalCalendarISO(d.getFullYear(),d.getMonth(),1).slice(0,7));return;}
    const day=event.target.closest?.('[data-profile-birth-day]'),clear=event.target.closest?.('[data-profile-birth-clear]'),todayButton=event.target.closest?.('[data-profile-birth-today]');
    if(day||clear||todayButton){
      const input=popup._trigger.closest('form')?.querySelector('input[name="'+popup._trigger.dataset.profileBirthOpen+'"]');
      if(input){input.value=clear?'':todayButton?today():day.dataset.profileBirthDay;popup._trigger.innerHTML=(input.value?input.value.split('-').reverse().join('/'):'dd/mm/yyyy')+' '+icon('calendar');input.dispatchEvent(new Event('change',{bubbles:true}));}
      closeProfileBirthCalendar();
    }
  });
  document.addEventListener('change',event=>{
    if(!event.target.matches?.('[data-profile-birth-month]'))return;
    const popup=event.target.closest('[data-profile-birth-calendar]');if(!popup)return;
    const year=popup._year,month=Number(popup.querySelector('[data-profile-birth-month]').value);
    openProfileBirthCalendar(popup._trigger,rentalCalendarISO(year,month-1,1).slice(0,7));
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeProfileBirthCalendar();});
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-rental-date-open]');
    if(trigger){event.preventDefault();rentalCalendarMonth=null;openRentalCalendar(trigger);return;}
    const calendar=event.target.closest?.('[data-rental-calendar]');
    if(!calendar){closeRentalCalendar();return;}
    const input=calendar._trigger?.closest('form')?.querySelector('input[name="'+calendar.dataset.rentalCalendar+'"]');
    if(!input)return;
    const nav=event.target.closest('[data-rental-cal-nav]');
    if(nav){const [y,m]=rentalCalendarMonth.split('-').map(Number),next=new Date(y,m-1+Number(nav.dataset.rentalCalNav),1);rentalCalendarMonth=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0');calendar._trigger.dataset.rentalCalendarMonth='keep';openRentalCalendar(calendar._trigger);return;}
    const day=event.target.closest('[data-rental-date-value]'),today=event.target.closest('[data-rental-cal-today]'),clear=event.target.closest('[data-rental-cal-clear]');
    if(day||today||clear){
      const value=clear?'':today?(()=>{const now=new Date(),todayValue=rentalCalendarISO(now.getFullYear(),now.getMonth(),now.getDate()),startValue=input.form.querySelector('input[name="start"]')?.value||'';return calendar.dataset.rentalCalendar==='end'&&startValue>todayValue?startValue:todayValue})():day.dataset.rentalDateValue;
      input.value=value;
      calendar._trigger.innerHTML=formatRentalDate(value)+' '+icon('calendar');
      const form=input.form,start=form.querySelector('input[name="start"]'),end=form.querySelector('input[name="end"]');
      if(start.value&&end.value&&end.value<start.value){end.value='';const endButton=form.querySelector('[data-rental-date-open="end"]');if(endButton)endButton.innerHTML='dd/mm/yyyy '+icon('calendar');}
      input.dispatchEvent(new Event('change',{bubbles:true}));closeRentalCalendar();
      if(day&&calendar.dataset.rentalCalendar==='start'){const endButton=form.querySelector('[data-rental-date-open="end"]');if(endButton&&!end.value)openRentalCalendar(endButton);}
    }
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeRentalCalendar();});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-rental-filters-toggle]');if(!button)return;event.preventDefault();const sidebar=document.querySelector('.rental-sidebar');if(!sidebar)return;const open=sidebar.classList.toggle('is-open');button.setAttribute('aria-expanded',String(open));});
  document.addEventListener('change',event=>{if(event.target.matches?.('.rental-results-bar select[name="sort"], .rental-sidebar input, .rental-sidebar select'))event.target.form?.requestSubmit();});

  // Photo ordering stays inside the editor until the owner saves.
  let draggedBoatPhoto=null;
  function updateBoatPhotoOrder(gallery){
    if(!gallery)return;
    Array.from(gallery.querySelectorAll('.fleet-photo-card')).forEach((card,i)=>{
      const position=card.querySelector('.fleet-photo-position');
      if(position)position.textContent=i===0?'Cover photo':'Photo '+(i+1);
      card.querySelector('[data-photo-move="-1"]')?.toggleAttribute('disabled',i===0);
      card.querySelector('[data-photo-move="1"]')?.toggleAttribute('disabled',i===gallery.children.length-1);
    });
  }
  const pendingBoatPhotoFiles=new WeakMap();
  const pendingBoatPhotoUrls=new WeakMap();
  function renderPendingBoatPhotos(input){
    const form=input.closest('[data-live-form="boat"]');
    const preview=form?.querySelector('[data-pending-photo-preview]');
    if(!preview)return;
    for(const url of pendingBoatPhotoUrls.get(input)||[])URL.revokeObjectURL(url);
    preview.replaceChildren();
    const urls=[],files=pendingBoatPhotoFiles.get(input)||[];
    files.forEach((file,i)=>{
      const url=URL.createObjectURL(file);urls.push(url);
      const card=document.createElement('div');
      card.style.cssText='overflow:hidden;border-radius:15px;border:1px solid #d4e5e9;background:#fff;box-shadow:0 8px 20px rgba(12,56,70,.05)';
      const picture=document.createElement('img');
      picture.src=url;picture.alt='Selected photo '+(i+1);
      picture.style.cssText='width:100%;height:125px;object-fit:cover;display:block';
      const bar=document.createElement('div');
      bar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:9px 10px;gap:6px';
      const title=document.createElement('span');
      title.textContent='New photo '+(i+1);title.style.cssText='font-size:12px;font-weight:700;color:#245365';
      const remove=document.createElement('button');
      remove.type='button';remove.dataset.pendingPhotoRemove=String(i);
      remove.textContent='Remove';remove.setAttribute('aria-label','Remove selected photo '+(i+1));
      remove.style.cssText='border:0;background:transparent;color:#aa6672;font-weight:700;font-size:12px;cursor:pointer;padding:4px';
      bar.append(title,remove);card.append(picture,bar);preview.append(card);
    });
    pendingBoatPhotoUrls.set(input,urls);
    const output=input.closest('.fleet-photo-upload')?.querySelector('[data-photo-file-count]');
    if(output)output.textContent=files.length?files.length+' photo'+(files.length===1?'':'s')+' ready to upload':'JPG, PNG or WebP · Up to 5 MB each';
  }
  function updatePendingBoatPhotoInput(input,files){
    const transfer=new DataTransfer();
    files.forEach(file=>transfer.items.add(file));
    input.files=transfer.files;
    pendingBoatPhotoFiles.set(input,files);
    renderPendingBoatPhotos(input);
  }
  document.addEventListener('change',event=>{
    const input=event.target;
    if(!input.matches?.('#boat-description input[name="photos"]'))return;
    const existing=pendingBoatPhotoFiles.get(input)||[];
    const selected=[...existing,...Array.from(input.files||[])];
    const unique=[...new Map(selected.map(file=>[[file.name,file.size,file.lastModified].join(':'),file])).values()];
    const saved=Array.from(input.closest('[data-live-form="boat"]')?.querySelectorAll('.fleet-photo-card:not(.is-removed)')||[]).length;
    if(saved+unique.length>15){toast('A listing can have a maximum of 15 photos.');updatePendingBoatPhotoInput(input,existing);return;}
    updatePendingBoatPhotoInput(input,unique);
  });
  document.addEventListener('click',event=>{
    const remove=event.target.closest?.('[data-pending-photo-remove]');
    if(!remove)return;
    const input=remove.closest('#boat-description')?.querySelector('input[name="photos"]');
    if(!input)return;
    const index=Number(remove.dataset.pendingPhotoRemove);
    updatePendingBoatPhotoInput(input,(pendingBoatPhotoFiles.get(input)||[]).filter((_,i)=>i!==index));
  });


  // Pointer-based sorting works from every pixel of a photo on desktop and touch.
  let photoPointerDrag=null;
  document.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const image=event.target.closest?.('.fleet-photo-card img');
    if(!image||!image.closest('#boat-description'))return;
    const card=image.closest('.fleet-photo-card');
    photoPointerDrag={card,image,id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,ghost:null};
    try{image.setPointerCapture(event.pointerId);}catch(_){}
  },true);
  document.addEventListener('pointermove',event=>{
    const drag=photoPointerDrag;
    if(!drag||drag.id!==event.pointerId)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
    event.preventDefault();
    if(!drag.moved){
      drag.moved=true;
      drag.card.classList.add('is-dragging');
      const ghost=drag.image.cloneNode();
      ghost.className='fleet-photo-drag-ghost';
      ghost.style.cssText='position:fixed;width:150px;height:105px;object-fit:cover;border-radius:12px;pointer-events:none;z-index:99999;box-shadow:0 15px 35px rgba(0,0,0,.25);opacity:.92;left:0;top:0;';
      document.body.appendChild(ghost);
      drag.ghost=ghost;
    }
    if(drag.ghost)drag.ghost.style.transform='translate('+(event.clientX-75)+'px,'+(event.clientY-52)+'px)';
    const gallery=drag.card.parentElement;
    if(!gallery)return;
    const others=Array.from(gallery.querySelectorAll('.fleet-photo-card')).filter(card=>card!==drag.card);
    let nearest=null,best=Infinity;
    for(const card of others){
      const bounds=card.getBoundingClientRect();
      const cx=bounds.left+bounds.width/2,cy=bounds.top+bounds.height/2;
      const distance=Math.hypot(event.clientX-cx,event.clientY-cy);
      if(distance<best){best=distance;nearest=card;}
    }
    if(!nearest)return;
    const currentBounds=drag.card.getBoundingClientRect();
    const ownDistance=Math.hypot(event.clientX-(currentBounds.left+currentBounds.width/2),event.clientY-(currentBounds.top+currentBounds.height/2));
    if(best>=ownDistance)return;
    const bounds=gallery.getBoundingClientRect();
    if(event.clientX<bounds.left-40||event.clientX>bounds.right+40||event.clientY<bounds.top-40||event.clientY>bounds.bottom+40)return;
    const cards=Array.from(gallery.children);
    const from=cards.indexOf(drag.card),to=cards.indexOf(nearest);
    if(from<0||to<0||from===to)return;
    gallery.insertBefore(drag.card,to<from?nearest:nearest.nextSibling);
    updateBoatPhotoOrder(gallery);
  },{capture:true,passive:false});
  function finishPhotoPointerDrag(event){
    const drag=photoPointerDrag;
    if(!drag||drag.id!==event.pointerId)return;
    drag.ghost?.remove();
    drag.card.classList.remove('is-dragging');
    if(drag.moved){event.preventDefault();updateBoatPhotoOrder(drag.card.parentElement);}
    try{drag.image.releasePointerCapture(event.pointerId);}catch(_){}
    photoPointerDrag=null;
  }
  document.addEventListener('pointerup',finishPhotoPointerDrag,true);
  document.addEventListener('pointercancel',finishPhotoPointerDrag,true);
  document.addEventListener('dragstart',event=>{
    const card=event.target.closest?.('.fleet-photo-card[draggable="true"]');
    if(!card)return;
    draggedBoatPhoto=card;
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',card.dataset.photoUrl||'photo');
    card.classList.add('is-dragging');
  });
  document.addEventListener('dragover',event=>{
    const card=event.target.closest?.('.fleet-photo-card[draggable="true"]');
    if(!card||!draggedBoatPhoto||card.parentElement!==draggedBoatPhoto.parentElement)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
  });
  document.addEventListener('drop',event=>{
    const target=event.target.closest?.('.fleet-photo-card[draggable="true"]');
    if(!target||!draggedBoatPhoto||target.parentElement!==draggedBoatPhoto.parentElement)return;
    event.preventDefault();
    const gallery=target.parentElement;
    if(target!==draggedBoatPhoto){
      const bounds=target.getBoundingClientRect();
      const after=event.clientX>bounds.left+bounds.width/2;
      gallery.insertBefore(draggedBoatPhoto,after?target.nextSibling:target);
    }
    draggedBoatPhoto.classList.remove('is-dragging');draggedBoatPhoto=null;
    updateBoatPhotoOrder(gallery);
  });
  document.addEventListener('dragend',()=>{draggedBoatPhoto?.classList.remove('is-dragging');draggedBoatPhoto=null;});

  // Removing a photo is a pending edit with Undo; database changes happen on save.
  let lastPhotoRemoval=null;
  document.addEventListener('click',event=>{
    const remove=event.target.closest?.('[data-photo-delete]');
    if(remove){
      event.preventDefault();
      const card=remove.closest('.fleet-photo-card'),gallery=card?.parentElement;
      if(!gallery)return;
      const form=card.closest('form'),index=Array.from(gallery.children).indexOf(card);
      const marker=document.createElement('input');
      marker.type='hidden';marker.name='remove_photo';marker.value=card.dataset.photoUrl;
      form.appendChild(marker);
      card.remove();
      lastPhotoRemoval={card,gallery,index,marker};
      const undo=form.querySelector('[data-photo-undo]');
      if(undo){undo.hidden=false;undo.querySelector('span').textContent='Photo removed. Save to apply the change.';}
      updateBoatPhotoOrder(gallery);
      const summary=form.querySelector('[data-photo-summary]');
      if(summary)summary.textContent=gallery.children.length+' photos remaining. Drag to reorder; save to apply changes.';
      return;
    }
    const restore=event.target.closest?.('[data-photo-restore]');
    if(!restore||!lastPhotoRemoval)return;
    event.preventDefault();
    const {card,gallery,index,marker}=lastPhotoRemoval;
    gallery.insertBefore(card,gallery.children[index]||null);
    marker.remove();
    lastPhotoRemoval=null;
    restore.closest('[data-photo-undo]').hidden=true;
    updateBoatPhotoOrder(gallery);
    const summary=gallery.closest('form')?.querySelector('[data-photo-summary]');
    if(summary)summary.textContent=gallery.children.length+' photos saved. Drag to reorder; save to apply changes.';
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-photo-move]');
    if(!button)return;
    event.preventDefault();
    const card=button.closest('.fleet-photo-card'),gallery=card?.parentElement;
    if(!gallery)return;
    const step=Number(button.dataset.photoMove);
    if(step<0&&card.previousElementSibling)gallery.insertBefore(card,card.previousElementSibling);
    if(step>0&&card.nextElementSibling)gallery.insertBefore(card.nextElementSibling,card);
    updateBoatPhotoOrder(gallery);
  });
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-live]');if(!b)return;e.preventDefault();if(b.disabled)return;b.disabled=true;try{switch(b.dataset.live){case 'boat-step':{const form=b.closest('[data-live-form="boat"]'),from=Number(form?.dataset.editorStep||1),to=Number(b.dataset.step||1);let valid=true;if(to>from){for(let step=from;step<to;step++)if(!validateOwnerBoatStep(form,step)){valid=false;break;}}if(valid)showOwnerBoatStep(form,to);break;}case 'boat-next':{const form=b.closest('[data-live-form="boat"]'),step=Number(form?.dataset.editorStep||1);if(validateOwnerBoatStep(form,step))showOwnerBoatStep(form,step+1);break;}case 'boat-prev':{const form=b.closest('[data-live-form="boat"]');showOwnerBoatStep(form,Number(form?.dataset.editorStep||1)-1);break;}case 'boat-jump':case 'owner-jump':document.getElementById?.(b.dataset.id)?.scrollIntoView?.({block:'start',behavior:'smooth'});break;case 'share-listing':{const url=location.origin+location.pathname+'#/listing/'+encodeURIComponent(b.dataset.id);if(navigator.share){try{await navigator.share({title:b.dataset.title||'Get By Boat',url});}catch(error){if(error?.name!=='AbortError')throw error;}}else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);toast('Listing link copied.');}else{window.prompt('Copy listing link:',url);}break;}case 'favourite':case 'unfavourite':{const saving=b.dataset.live==='favourite';if(!session){location.hash='#/login?next='+encodeURIComponent(location.hash);break;}if(profile?.account_type!=='customer')throw Error('Only customer accounts can save rental favourites.');if(saving)check(await client.from('favourites').upsert({user_id:session.user.id,boat_id:b.dataset.id},{onConflict:'user_id,boat_id',ignoreDuplicates:true}));else check(await client.from('favourites').delete().eq('user_id',session.user.id).eq('boat_id',b.dataset.id));document.querySelectorAll('[data-live="favourite"],[data-live="unfavourite"]').forEach(button=>{if(button.dataset.id!==b.dataset.id)return;button.dataset.live=saving?'unfavourite':'favourite';button.classList.toggle('is-saved',saving);button.setAttribute('aria-pressed',String(saving));button.setAttribute('aria-label',saving?'Remove from favorites':'Add to favorites');button.title=saving?'Remove from favorites':'Add to favorites';const label=button.querySelector('span');if(label)label.textContent=saving?'Added to favorites':'Add to favorites';});if(!saving&&parseRoute().path==='/favourites'){b.closest('.live-card')?.remove();if(!document.querySelector('.live-grid .live-card')){const grid=document.querySelector('.live-grid');if(grid)grid.innerHTML='<p>No saved boats yet. <a href="#/boats">Explore boats</a></p>';}}if(saving)toast('Saved to favourites.');break;}case 'auth-close':closeAuth();break;case 'social-google':case 'social-apple':{
      const provider=b.dataset.live==='social-google'?'google':'apple';
      const feedback=document.querySelector('[data-feedback]');
      if(feedback)feedback.textContent='Checking sign-in availability…';
      try {
        const response=await fetch(AUTH_CONFIG.supabaseUrl+'/auth/v1/settings',{headers:{apikey:AUTH_CONFIG.supabasePublishableKey||''}});
        if(!response.ok)throw Error('Could not check sign-in availability. Please try again.');
        const config=await response.json();
        if(config.external?.[provider]!==true){if(feedback)feedback.textContent='This sign-in option is awaiting activation. Use email and password for now.';break;}
        if(feedback)feedback.textContent='Connecting…';
        check(await client.auth.signInWithOAuth({provider,options:{redirectTo:authRedirect()}}));
      } catch(error) {if(feedback)feedback.textContent=error.message||'Sign-in could not start. Please try again.';else throw error;}
      break;
    }case 'refresh':await current();render();break;case 'auth-mode':authEmail=document.querySelector('[name="email"]')?.value||authEmail;authMode=authMode==='login'?'signup':'login';render();break;case 'logout':case 'logout-owner':{const createOwner=b.dataset.live==='logout-owner';check(await client.auth.signOut());session=null;profile=null;authStep='email';authEmail='';authNext=createOwner?'#/owner':'#/dashboard';ownerIntent=createOwner;window.GBB_ACCOUNT_LINK=null;window.GBB_ACCOUNT_ROLE=null;authBackground=null;returnRoute='#/';document.body?.classList.remove('auth-open');if(createOwner){location.hash=loginLink(authNext);render()}else if(location.hash!=='#/'){location.hash='#/'}else render();break}case 'reset':{const email=document.querySelector('[name="email"]')?.value;if(!email)throw Error('Enter your email address first.');check(await client.auth.resetPasswordForEmail(email,{redirectTo:authRedirect()}));toast('Check your email for the password reset link.');break}case 'accept-special-offer':{check(await client.rpc('accept_booking_offer',{p_offer_id:b.dataset.id}));render();toast('Offer accepted. Payment processing is not yet available.');break}case 'accept':case 'decline':case 'cancel':{const action=b.dataset.live;const booking=check(await client.from('bookings').update({status:{accept:'awaiting_payment',decline:'declined',cancel:'cancelled'}[action]}).eq('id',b.dataset.id).select().single());if(action==='accept'||action==='decline')notifyBookingEmail(action==='accept'?'owner_accepted':'owner_declined',booking.id);render();break}case 'unblock':check(await client.from('boat_blocks').delete().eq('id',b.dataset.id).select().single());render();break}}catch(err){toast(err.message||'Please try again.')}finally{b.disabled=false}});
  document.addEventListener('click',async event=>{
    const calendarOverlay=document.querySelector('[data-booking-calendar-dialog]');
    const openDate=event.target.closest?.('[data-booking-date-open]');
    if(openDate){
      event.preventDefault();
      const form=openDate.closest('[data-live-form="request"]');
      bookingDateDraft={start:form.querySelector('[name="start_date"]').value,end:form.querySelector('[name="end_date"]').value};
      bookingDateMonth=bookingDateDraft.start.slice(0,7);
      bookingCalendarDialog();return;
    }
    if(calendarOverlay&&event.target===calendarOverlay){closeBookingCalendar();return;}
    if(event.target.closest?.('[data-booking-date-close]')){closeBookingCalendar();return;}
    const monthButton=event.target.closest?.('[data-booking-month]');
    if(monthButton&&calendarOverlay){bookingDateMonth=shiftMonth(bookingDateMonth,Number(monthButton.dataset.bookingMonth));bookingCalendarDialog();return;}
    if(event.target.closest?.('[data-booking-date-clear]')){bookingDateDraft={start:null,end:null};bookingCalendarDialog();return;}
    const pickedDate=event.target.closest?.('[data-booking-day]');
    if(pickedDate&&bookingDateDraft){
      const chosen=pickedDate.dataset.bookingDay,form=document.querySelector('[data-live-form="request"]');
      if(!bookingDateDraft.start||bookingDateDraft.end){bookingDateDraft={start:chosen,end:null};}
      else{
        const start=chosen<bookingDateDraft.start?chosen:bookingDateDraft.start,end=chosen>bookingDateDraft.start?chosen:bookingDateDraft.start;
        const unavailable=JSON.parse(form?.dataset.unavailable||'[]');
        if(unavailable.some(r=>r.start_date<=end&&r.end_date>=start)){calendarOverlay.querySelector('[data-booking-calendar-status]').textContent='The selected range includes unavailable dates.';return;}
        bookingDateDraft={start,end};
      }
      bookingCalendarDialog();return;
    }
    if(event.target.closest?.('[data-booking-date-save]')&&bookingDateDraft?.start&&bookingDateDraft?.end){
      const form=document.querySelector('[data-live-form="request"]');
      if(form){
        form.querySelector('[name="start_date"]').value=bookingDateDraft.start;
        form.querySelector('[name="end_date"]').value=bookingDateDraft.end;
        form.querySelector('[data-booking-start-label]').textContent=euroDate(bookingDateDraft.start);
        form.querySelector('[data-booking-end-label]').textContent=euroDate(bookingDateDraft.end);
        state.start=bookingDateDraft.start;state.end=bookingDateDraft.end;quote();
      }
      closeBookingCalendar();return;
    }
    const listingMonth=event.target.closest?.('[data-listing-month]');
    if(listingMonth&&listingCalendarContext){
      event.preventDefault();
      const calendar=document.querySelector('#boat-availability');
      if(!calendar)return;
      calendar.outerHTML=listingAvailabilityCalendar(listingCalendarContext.unavailable,listingMonth.dataset.listingMonth);
      syncListingCalendarSelection();
      return;
    }
    const listingDay=event.target.closest?.('[data-listing-date]');
    if(listingDay&&listingCalendarContext){
      event.preventDefault();
      const chosen=listingDay.dataset.listingDate;
      if(!listingCalendarSelection||!listingCalendarSelection.awaitingSecond){
        listingCalendarSelection={anchor:chosen,end:chosen,awaitingSecond:true};
      }else{
        const start=chosen<listingCalendarSelection.anchor?chosen:listingCalendarSelection.anchor;
        const end=chosen>listingCalendarSelection.anchor?chosen:listingCalendarSelection.anchor;
        if(listingCalendarContext.unavailable.some(r=>r.start_date<=end&&r.end_date>=start)){
          const hint=document.querySelector('[data-listing-calendar-hint]');
          if(hint)hint.textContent='That range includes an unavailable day. Please choose a different end date.';
          return;
        }
        listingCalendarSelection={anchor:start,end,awaitingSecond:false};
      }
      const form=document.querySelector('[data-live-form="request"]');
      if(form){
        form.querySelector('[name="start_date"]').value=[listingCalendarSelection.anchor,listingCalendarSelection.end].sort()[0];
        form.querySelector('[name="end_date"]').value=[listingCalendarSelection.anchor,listingCalendarSelection.end].sort()[1];
        quote();
      }
      syncListingCalendarSelection();
      return;
    }
    const equipmentCategory=event.target.closest?.('[data-equipment-category]');
    if(equipmentCategory){
      event.preventDefault();
      const picker=equipmentCategory.closest('[data-equipment-picker]');
      picker.dataset.activeCategory=equipmentCategory.dataset.equipmentCategory;
      syncEquipmentPicker(equipmentCategory.closest('[data-live-form="boat"]'));
      return;
    }
    const equipmentFilter=event.target.closest?.('[data-equipment-selected-only]');
    if(equipmentFilter){
      event.preventDefault();
      equipmentFilter.setAttribute('aria-pressed',String(equipmentFilter.getAttribute('aria-pressed')!=='true'));
      syncEquipmentPicker(equipmentFilter.closest('[data-live-form="boat"]'));
      return;
    }
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
    const search=event.target.closest?.('[data-pickup-search]');
    if(search){
      event.preventDefault();
      const form=search.closest('[data-live-form="boat"]'),mapState=ownerPickupMap;
      if(!mapState||mapState.form!==form){toast('Map unavailable. Please try again in a moment.');return;}
      const address=String(form.querySelector('[name="pickup_location"]')?.value||'').trim();
      const city=String(form.querySelector('[name="location"]')?.value||'').trim();
      const country=String(form.querySelector('[name="country"]')?.value||'').trim();
      if(!address||!city||!country){toast('Enter the meeting address, city and country first.');return;}
      const status=form.querySelector('[data-pickup-status]');
      const now=Date.now();
      if(search.dataset.lastSearch&&now-Number(search.dataset.lastSearch)<1200){toast('Please wait a moment before searching again.');return;}
      search.dataset.lastSearch=String(now);
      search.disabled=true;
      if(status)status.textContent='Looking up this address…';
      try{
        const query=[address,city,country].join(', ');
        const response=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(query),{headers:{Accept:'application/json'}});
        if(!response.ok)throw Error('Address search is unavailable right now.');
        const results=await response.json();
        if(!Array.isArray(results)||!results.length)throw Error('Address not found. Try a marina name or position the pin manually.');
        const point={lat:Number(results[0].lat),lng:Number(results[0].lon)};
        if(!validPickupCoordinates(point.lat,point.lng))throw Error('The address search returned invalid coordinates.');
        mapState.marker.setLatLng(point);mapState.map.setView(point,15);mapState.setCoordinates(point);
        if(status)status.textContent='Address located. Check and drag the pin to the exact meeting spot before saving.';
      }catch(error){if(status)status.textContent=error.message||'Address search failed. You can drag the pin manually.';}
      finally{search.disabled=false;}
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
document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-live="deletion-send-code"]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation?.();
    if(button.disabled)return;
    const area=button.closest('.account-delete-expanded');
    const feedback=area?.querySelector('[data-delete-code-feedback]');
    button.disabled=true;if(feedback)feedback.textContent='Sending your verification code…';
    try{
      if(!client||!session)throw Error('Please sign in again.');
      const {data,error}=await client.functions.invoke('delete-account',{body:{action:'request'}});
      if(error||!data?.sent)throw Error(data?.error||error?.message||'Unable to send verification code.');
      area?.querySelector('.account-delete-code-form')?.removeAttribute('hidden');
      if(feedback)feedback.textContent='Code sent. Check your inbox or spam folder.';
      button.textContent='Send a new code';
    }catch(error){if(feedback)feedback.textContent=error.message||'Email verification is unavailable.';}
    finally{button.disabled=false;}
  },true);
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(form?.dataset?.liveForm!=='delete-account')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const feedback=form.querySelector('[data-feedback]');
    const submit=form.querySelector('button[type="submit"]');
    const code=form.querySelector('[name="code"]')?.value?.trim();
    const acknowledged=form.querySelector('[name="understand"]')?.checked;
    if(!/^\d{6}$/.test(code||'')||!acknowledged){if(feedback)feedback.textContent='Enter the 6-digit email code and confirm your choice.';return;}
    if(!window.confirm('Permanently delete your Get By Boat account? This cannot be undone.'))return;
    if(submit)submit.disabled=true;
    if(feedback)feedback.textContent='Deleting your account…';
    try{
      if(!client||!session)throw Error('Please sign in again.');
      const {data,error}=await client.functions.invoke('delete-account',{body:{action:'confirm',code}});
      if(error||!data?.deleted)throw Error(data?.error||error?.context?.error||error?.message||'Unable to delete this account.');
      await client.auth.signOut().catch(()=>{});
      session=null;profile=null;window.GBB_ACCOUNT_LINK=null;window.GBB_ACCOUNT_ROLE=null;
      location.hash='#/';render();
      alert(data.confirmation_email_sent?'Your Get By Boat account has been deleted. A confirmation email has been sent.':'Your Get By Boat account has been deleted. We could not send the confirmation email.');
    }catch(error){
      if(feedback)feedback.textContent=error.message||'Unable to delete account.';
      if(submit)submit.disabled=false;
    }
  },true);
    // Static sample boats cannot create real requests or paid confirmations.
  document.addEventListener('submit',e=>{if(['reserve-form','checkout-form'].includes(e.target.id)){e.preventDefault();e.stopImmediatePropagation();modal('Example boat','This is an example listing. Explore the live boat catalogue to send a real booking request.');}},true);
  async function boot(){try{client=await authClient();client.auth.onAuthStateChange((event,s)=>{session=s;if(event==='PASSWORD_RECOVERY'){recovery=true;setTimeout(()=>{location.hash='#/login';render()},0)}if(event==='SIGNED_OUT'){profile=null;setTimeout(()=>render(),0)}});await current();if(new URLSearchParams(location.search).has('auth_callback')){const p=parseRoute().params;authNext=safeNext(p.get('next')||(ownerIntent?'#/owner':'#/dashboard'));history.replaceState(null,'',location.pathname+loginLink(authNext));}authReady=true;render()}catch(e){app.innerHTML=page('Connection unavailable.',`<p>${errorText(e)}</p><button class="btn" onclick="location.reload()">Retry</button>`)}}
  setInterval(()=>{
    const active=parseRoute().path;
    if(!session||!['/dashboard','/owner','/account','/bookings','/favourites','/messages'].includes(active))return;
    refreshSidebarNotifications().catch(()=>{});
  },20000);
  // Wait for the persisted auth session before showing protected screens.
  // This avoids a login/home flash during a normal authenticated refresh.
  app.innerHTML=accountLoading;
  boot();
})();
