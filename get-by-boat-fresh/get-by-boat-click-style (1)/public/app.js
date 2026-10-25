'use strict';
// Frontend preview only. No authentication, payments, or owner booking confirmations.
const countries = [
  {name:'Croatia',flag:'🇭🇷',caption:'Split · Hvar · Dubrovnik'},
  {name:'Greece',flag:'🇬🇷',caption:'Athens · Mykonos · Corfu'},
  {name:'Spain',flag:'🇪🇸',caption:'Ibiza · Mallorca · Barcelona'},
  {name:'Italy',flag:'🇮🇹',caption:'Sardinia · Amalfi · Sicily'},
  {name:'France',flag:'🇫🇷',caption:'Cannes · Nice · Marseille'},
  {name:'USA',flag:'🇺🇸',caption:'Miami · California · Florida'},
  {name:'Bahamas',flag:'🇧🇸',caption:'Nassau · Exuma'},
  {name:'Australia',flag:'🇦🇺',caption:'Sydney · Gold Coast'}
];
const boats = [
  {id:1,name:'Adriatic Blue',city:'Split',country:'Croatia',type:'Motorboat',guests:8,price:350,tag:'Popular choice',photo:'photo-1567899378494-47b22a2ae96a'},
  {id:2,name:'Aegean Escape',city:'Mykonos',country:'Greece',type:'Yacht',guests:10,price:950,tag:'With skipper',photo:'photo-1544551763-46a013bb70d5'},
  {id:3,name:'Ibiza Summer',city:'Ibiza',country:'Spain',type:'Motorboat',guests:7,price:480,tag:'Top destination',photo:'photo-1569263979104-865ab7cd8d13'},
  {id:4,name:'Sardinia Breeze',city:'Olbia',country:'Italy',type:'Sailboat',guests:8,price:410,tag:'Explore the coast',photo:'photo-1500534623283-312aade485b7'},
  {id:5,name:'Riviera Dreams',city:'Cannes',country:'France',type:'Yacht',guests:12,price:1290,tag:'Luxury charter',photo:'photo-1544551763-46a013bb70d5'},
  {id:6,name:'Miami Waves',city:'Miami',country:'USA',type:'Motorboat',guests:8,price:630,tag:'City escape',photo:'photo-1567899378494-47b22a2ae96a'},
  {id:7,name:'Bahama Blue',city:'Nassau',country:'Bahamas',type:'Catamaran',guests:10,price:790,tag:'Island hopping',photo:'photo-1569263979104-865ab7cd8d13'},
  {id:8,name:'Harbour Explorer',city:'Sydney',country:'Australia',type:'Sailboat',guests:6,price:440,tag:'Sailing favorite',photo:'photo-1544551763-46a013bb70d5'}
];
const $ = id => document.getElementById(id);
const escapeHTML = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatPrice = amount => new Intl.NumberFormat('en-US',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(amount);
const dateToday = () => { const d=new Date();const diff=d.getTimezoneOffset();d.setMinutes(d.getMinutes()-diff);return d.toISOString().slice(0,10); };
const startDate=$('startDate'), endDate=$('endDate');
startDate.min=dateToday();endDate.min=dateToday();
startDate.addEventListener('change',()=>{endDate.min=startDate.value||dateToday();if(endDate.value&&endDate.value<startDate.value)endDate.value='';});

const destinationGrid=$('destinationGrid');
countries.forEach(c=>{
  const btn=document.createElement('button');btn.type='button';btn.className='destination-card';
  btn.innerHTML=`<span class="flag" aria-hidden="true">${c.flag}</span><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.caption)} →</small>`;
  btn.setAttribute('aria-label',`Explore sample boats in ${c.name}`);
  btn.addEventListener('click',()=>{ $('countryFilter').value=c.name;$('locationInput').value=c.name;applyFilters();$('boats').scrollIntoView({behavior:'smooth'}); });
  destinationGrid.append(btn);
  const opt=document.createElement('option');opt.value=c.name;opt.textContent=c.name;$('countryFilter').append(opt);
});

function applyFilters(){
  const search=$('locationInput').value.trim().toLocaleLowerCase();
  const country=$('countryFilter').value;
  const type=$('typeFilter').value;
  const sort=$('sortFilter').value;
  let found=boats.filter(b=>{
    const searchable=`${b.city} ${b.country} ${b.name}`.toLocaleLowerCase();
    return (!search||searchable.includes(search))&&(!country||b.country===country)&&(!type||b.type===type);
  });
  if(sort==='low')found.sort((a,b)=>a.price-b.price);
  if(sort==='high')found.sort((a,b)=>b.price-a.price);
  const grid=$('boatGrid');grid.replaceChildren();
  $('resultsDescription').textContent=`${found.length} sample boat${found.length===1?'':'s'} ${found.length?'to explore':'match your filters'}.`;
  if(!found.length){ const empty=document.createElement('div');empty.className='empty';empty.innerHTML='<strong>No sample boats found.</strong><p>Try another country, city or boat type.</p>';grid.append(empty);return;}
  found.forEach(boat=>{
    const card=document.createElement('article');card.className='boat-card';
    const photo=`https://images.unsplash.com/${boat.photo}?auto=format&fit=crop&w=900&q=78`;
    card.innerHTML=`<div class="boat-photo"><img alt="Illustrative photograph for ${escapeHTML(boat.type)}" loading="lazy" src="${photo}"><span class="tag">${escapeHTML(boat.tag)}</span></div><div class="boat-body"><div class="boat-location">📍 ${escapeHTML(boat.city)}, ${escapeHTML(boat.country)}</div><h3>${escapeHTML(boat.name)}</h3><div class="boat-facts"><span>${escapeHTML(boat.type)}</span><span>Up to ${boat.guests} guests</span><span>Sample</span></div><div class="boat-footer"><div class="boat-price">${formatPrice(boat.price)}<small>illustrative / day</small></div><button type="button" class="view-button">View details →</button></div></div>`;
    card.querySelector('button').addEventListener('click',()=>showBoat(boat));
    grid.append(card);
  });
}
function setDialog(id,html,contentId){$(contentId).innerHTML=html;$(id).showModal();}
function close(id){$(id).close();}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>close(b.dataset.close)));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();}));
function showBoat(boat){
  setDialog('detailDialog',`<h2 id="detailTitle">${escapeHTML(boat.name)}</h2><p>${escapeHTML(boat.city)}, ${escapeHTML(boat.country)} · ${escapeHTML(boat.type)} · Up to ${boat.guests} guests</p><p class="summary">Illustrative price: <strong>${formatPrice(boat.price)} per day</strong>. This is a sample listing and is not available to reserve.</p><div class="account-choice" role="group" aria-label="Booking options"><button class="selected" type="button" id="guestChoice">Continue as guest</button><button type="button" id="accountChoice">Log in</button></div><div id="guestPane"><h3>Booking request preview</h3><form id="guestForm"><label>Your name<input required name="name" maxlength="90" autocomplete="name" placeholder="Full name"></label><label>Email address<input type="email" required name="email" maxlength="100" autocomplete="email" placeholder="you@example.com"></label><label>Preferred date<input type="date" required name="date" min="${dateToday()}"></label><button type="submit" class="primary">Save example request</button></form><p class="muted">Preview only: no payment will be taken, and no boat owner will be contacted.</p></div><div id="guestDone" aria-live="polite"></div>`,'detailContent');
  $('guestChoice').addEventListener('click',()=>{});
  $('accountChoice').addEventListener('click',()=>{close('detailDialog');showAccount();});
  $('guestForm').addEventListener('submit',e=>{
    e.preventDefault();const form=new FormData(e.currentTarget);const data={boatId:boat.id,boat:boat.name,name:form.get('name'),email:form.get('email'),date:form.get('date'),createdAt:new Date().toISOString()};
    try{const previous=JSON.parse(localStorage.getItem('getbyboat_preview_requests')||'[]');previous.push(data);localStorage.setItem('getbyboat_preview_requests',JSON.stringify(previous));$('guestForm').hidden=true;$('guestDone').innerHTML='<p class="success-note">Example request saved in this browser only. No booking was made and no payment was taken.</p>';}catch{$('guestDone').textContent='Your browser prevented saving this example request.';}
  });
}
function showAccount(){
  setDialog('accountDialog',`<h2 id="accountTitle">Welcome to Get By Boat</h2><p>Manage your boat searches, favorites and future reservations in one place.</p><div class="account-choice"><button type="button" id="loginChoice" class="selected">Log in</button><button type="button" id="registerChoice">Create account</button></div><div id="accountPreview"><label>Email address<input autocomplete="email" type="email" placeholder="you@example.com"></label><label>Password<input autocomplete="current-password" type="password" placeholder="Password"></label><button id="accountSubmit" type="button" class="primary">Log in</button><p class="muted">Account registration and secure authentication are not connected yet. This window is a visual preview.</p></div>`,'accountContent');
  const update=create=>{$('loginChoice').classList.toggle('selected',!create);$('registerChoice').classList.toggle('selected',create);$('accountSubmit').textContent=create?'Create account':'Log in';};
  $('loginChoice').addEventListener('click',()=>update(false));$('registerChoice').addEventListener('click',()=>update(true));$('accountSubmit').addEventListener('click',()=>alert('Account creation and login will be enabled after the secure backend is connected.'));
}
function showOwner(){
  setDialog('ownerDialog',`<h2 id="ownerTitle">Owner dashboard preview</h2><p>Everything boat owners will need to manage their rentals. This is a non-functional preview until owner accounts and the database are connected.</p><div class="mock-stats"><div><strong>0</strong><small>Active listings</small></div><div><strong>0</strong><small>Confirmed bookings</small></div><div><strong>€0</strong><small>Owner earnings</small></div></div><h3>Manage your charter business</h3><div class="inline-actions"><button type="button" id="newListing">+ Add a boat</button><button type="button" id="manageAvailability">Availability calendar</button><button type="button" id="ownerBookings">Bookings</button></div><p class="muted" id="ownerActionMessage">Real listing uploads, calendar updates, payout settings and bookings will be added with the marketplace backend.</p>`,'ownerContent');
  [['newListing','Adding boats'],['manageAvailability','Updating calendars'],['ownerBookings','Managing reservations']].forEach(([id,label])=>$(id).addEventListener('click',()=>{$('ownerActionMessage').textContent=`${label} requires an owner account and database. This dashboard is a design preview.`;}));
}
$('searchForm').addEventListener('submit',e=>{
  e.preventDefault();if(startDate.value&&endDate.value&&endDate.value<startDate.value){endDate.setCustomValidity('The ending date must be after the starting date.');endDate.reportValidity();return;}
  endDate.setCustomValidity('');
  // Match known country values; city text remains free text and is used for sample searches.
  const q=$('locationInput').value.trim();const matched=countries.find(c=>c.name.toLocaleLowerCase()===q.toLocaleLowerCase());
  $('countryFilter').value=matched?matched.name:'';
  $('typeFilter').value=$('boatType').value;
  applyFilters();$('boats').scrollIntoView({behavior:'smooth'});
});
endDate.addEventListener('change',()=>endDate.setCustomValidity(''));
$('countryFilter').addEventListener('change',()=>{$('locationInput').value=$('countryFilter').value;applyFilters();});
$('typeFilter').addEventListener('change',()=>{$('boatType').value=$('typeFilter').value;applyFilters();});
$('sortFilter').addEventListener('change',applyFilters);
$('clearFilters').addEventListener('click',()=>{$('locationInput').value='';$('boatType').value='';$('countryFilter').value='';$('typeFilter').value='';$('sortFilter').value='featured';applyFilters();});
$('ownerNav').addEventListener('click',showOwner);$('ownerCta').addEventListener('click',showOwner);$('loginNav').addEventListener('click',showAccount);
applyFilters();
