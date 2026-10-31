const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('public/app.js','utf8');
const helpers=source.slice(source.indexOf('function rentalDayCount('),source.indexOf('function boatDetail('));
const backend=fs.readFileSync('public/backend.js','utf8');
const sleep=()=>new Promise(r=>setTimeout(r,5));
async function environment({hash='#/login',user=null,profile=null,search='',request=null,review=null,ownerRequest=null,ownerReview=null,staff=false,boatOptions={}}={}){
 const state={user,profile,verificationRequest:request,verificationReview:review,ownerRequest,ownerReview,staff,writes:[],uploads:[],deletions:[],oauth:null,logins:0};const events={};const feedback={textContent:''};
 const boat={id:'boat-1',owner_id:'owner-1',name:'Test Boat',country:'Croatia',location:'Split',type:'Motorboat',price:800,guests:6,cabins:1,published:true,with_skipper:false,without_skipper:true,...boatOptions};
 const client={auth:{getUser:async()=>({data:{user:state.user}}),onAuthStateChange(){},signInWithPassword:async()=>{state.logins++;state.user={id:'guest-1'};return {data:{session:{user:state.user}}}},signInWithOAuth:async x=>{state.oauth=x;return {data:{}}},signOut:async()=>{state.user=null;return {data:{}}}},rpc:async(name)=>({data:name==='is_verification_staff'?state.staff:[]}),storage:{from(){return {upload:async(path,file)=>{state.uploads.push({path,file});return {data:{path}}},remove:async paths=>{state.deletions.push(...paths);return {data:paths}},createSignedUrl:async path=>({data:{signedUrl:'https://example.invalid/download/'+path}})}}},from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},update(value){state.writes.push({table,value});if(table==='profiles')state.profile={...state.profile,...value};return q},upsert(value){state.writes.push({table,value});if(table==='profiles')state.profile=value;if(table==='verification_requests')state.verificationRequest=value;if(table==='verification_reviews')state.verificationReview={...value,identity_path:state.verificationRequest.identity_path,licence_path:state.verificationRequest.licence_path,reviewed_birth_date:state.verificationRequest.birth_date,reviewed_licence_type:state.verificationRequest.licence_type,reviewed_licence_expiry:state.verificationRequest.licence_expiry,reviewed_name:state.profile.display_name};return q},insert(value){state.writes.push({table,value});return q},maybeSingle:async()=>({data:table==='profiles'?state.profile:table==='verification_requests'?state.verificationRequest:table==='verification_reviews'?state.verificationReview:null}),single:async()=>({data:table==='verification_requests'?state.verificationRequest:table==='verification_reviews'?state.verificationReview:boat}),then(resolve){resolve({data:table==='boats'?[boat]:table==='verification_requests'&&state.verificationRequest?[state.verificationRequest]:table==='verification_reviews'&&state.verificationReview?[state.verificationReview]:table==='profiles'&&state.profile?[{id:state.user?.id,...state.profile}]:[]})}};return q}};
 const originalFrom=client.from.bind(client);
 client.from=table=>{
   if(!['owner_verification_requests','owner_verification_reviews'].includes(table))return originalFrom(table);
   const ownerRow=()=>table==='owner_verification_requests'?state.ownerRequest:state.ownerReview;
   const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},upsert(value){
     state.writes.push({table,value});
     if(table==='owner_verification_requests')state.ownerRequest={...state.ownerRequest,...value};
     else state.ownerReview={...value,reviewed_name:state.profile.display_name,reviewed_request:Object.fromEntries(Object.entries(state.ownerRequest).filter(([k])=>k!=='application_state'))};
     return q;
   },maybeSingle:async()=>({data:ownerRow()}),single:async()=>({data:ownerRow()}),then(resolve){resolve({data:ownerRow()?[ownerRow()]:[]})}};
   return q;
 };
 const ctx={console,setTimeout,URL,URLSearchParams,Intl,Date,crypto:{randomUUID:()=>'00000000-0000-4000-a000-000000000001'},fetch:async()=>({ok:true,json:async()=>({external:{google:true,apple:true}})}),FormData:class{constructor(f){this.values=f.values}get(k){return this.values[k]??null}getAll(k){return this.values[k]||[]}},location:{hash,search,pathname:'/',origin:'https://getbyboat.net'},window:{},document:{addEventListener(k,fn){(events[k]??=[]).push(fn)},querySelector(s){return s==='[data-feedback]'?feedback:null}},app:{innerHTML:''},state:{start:'',end:''},AUTH_CONFIG:{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'},authMode:'login',authClient:async()=>client,home:()=>'<main>Home</main>',header:()=>'<header/>',footer:()=>'<footer/>',waveLogo:()=>'<span class="logo-mark"></span>',icon:()=>'<svg></svg>',safe:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),fmt:n=>String(n),toast(){},modal(){},parseRoute(){const [path,q]=ctx.location.hash.slice(1).split('?');return {path,params:new URLSearchParams(q)}},render(){ctx.window.liveRender()}};
 ctx.history={replaceState(_,__,url){const u=new URL(url,ctx.location.origin);ctx.location.hash=u.hash;ctx.location.search=u.search}};
 vm.createContext(ctx);vm.runInContext(helpers,ctx);vm.runInContext(backend,ctx);await sleep();
 return {ctx,state,feedback,async route(hash){ctx.location.hash=hash;ctx.render();await sleep();return ctx.app.innerHTML},async submit(kind,values,dataset={}){const button={disabled:false};const f={dataset:{liveForm:kind,...dataset},values,querySelector:s=>s==='[data-feedback]'?feedback:button};await events.submit[0]({target:f,preventDefault(){}});await sleep()},async click(action){const b={dataset:{live:action},disabled:false};await events.click[1]({target:{closest:()=>b},preventDefault(){}});await sleep()}};
}
(async()=>{
 // New customer: email step -> auth -> name onboarding -> customer dashboard.
 let e=await environment();assert.match(e.ctx.app.innerHTML,/Customer · Log in or sign up/);
 await e.submit('auth',{email:'test@example.invalid'});assert.equal(e.state.logins,0);assert.match(e.ctx.app.innerHTML,/name="password"/);
 await e.submit('auth',{email:'test@example.invalid',password:'not-a-real-password'});assert.equal(e.ctx.location.hash,'#/dashboard');
 let html=await e.route('#/dashboard');assert.match(html,/Finish signing up/);assert.match(html,/name="first_name"/);assert.match(html,/name="last_name"/);assert.equal(e.state.profile.account_type,'customer');
 await e.submit('profile',{first_name:'Guest',last_name:'Marin'},{accountType:'customer',next:'#/dashboard'});
 html=await e.route('#/dashboard');assert.match(html,/member-sidebar/);assert.match(html,/Booking requests/);assert.match(html,/Welcome aboard/);assert.doesNotMatch(html,/Everything you need for your next day at sea|Boating experience|List your boat|<footer|What should we call you/);
 assert.doesNotMatch(html.match(/<header class="member-header">([\s\S]*?)<\/header>/)?.[1]||'',/Explore boats|How it works/);
 html=await e.route('#/account');assert.match(html,/Personal information/);assert.match(html,/data-live-form="avatar"/);assert.doesNotMatch(html,/Boating experience/);
 html=await e.route('#/account?tab=experience');assert.match(html,/Personal information/);assert.doesNotMatch(html,/Boating experience|Your boat licences/);
 html=await e.route('#/bookings');assert.doesNotMatch(html,/My boats|Accept request/);
 await e.submit('details',{first_name:'Pere',last_name:'Juran',city:'Split'},{section:'information'});assert.equal(e.state.profile.display_name,'Pere Juran');assert.equal(e.state.profile.details.city,'Split');assert.equal(e.state.profile.account_type,'customer');
 // An existing customer cannot convert to owner, even by forging form submission.
 html=await e.route('#/owner');assert.match(html,/Only boat owners can list boats/);assert.doesNotMatch(html,/data-live-form="boat"|Continue as boat owner/);assert.equal(e.state.profile.account_type,'customer');
 await e.submit('profile',{first_name:'Pere',last_name:'Juran'},{accountType:'owner',next:'#/owner'});assert.equal(e.state.profile.account_type,'customer');assert.match(e.feedback.textContent,/Account roles cannot be changed/);
 const uploadsBefore=e.state.uploads.length;
 await e.submit('boat',{name:'Attempted listing',photo:{size:100,type:'image/jpeg'}});assert.equal(e.state.writes.filter(x=>x.table==='boats').length,0);assert.equal(e.state.uploads.length,uploadsBefore);
 // A guest's boat, dates and guest count survive email login and profile setup.
 e=await environment({hash:'#/listing/boat-1'});await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'4',skipper:'without'},{id:'boat-1'});
 const returnTo=new URLSearchParams(e.ctx.location.hash.split('?')[1]).get('next');assert.match(returnTo,/#\/listing\/boat-1\?start=2027-07-01&end=2027-07-03&guests=4/);assert.equal(e.state.writes.length,0);
 await e.route(e.ctx.location.hash);await e.submit('auth',{email:'guest@example.invalid'});await e.submit('auth',{email:'guest@example.invalid',password:'not-a-real-password'});
 assert.equal(e.ctx.location.hash,returnTo);
 html=await e.route(returnTo);assert.match(html,/value="2027-07-01"/);assert.match(html,/value="2027-07-03"/);assert.match(html,/name="guests" type="number" value="4"/);assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'4',skipper:'without'},{id:'boat-1'});
 assert.match(e.ctx.location.hash,/#\/account\?next=/);assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);
 html=await e.route(e.ctx.location.hash);assert.match(html,/name="first_name"/);
 await e.submit('profile',{first_name:'New',last_name:'Guest'},{accountType:'customer',next:returnTo});assert.equal(e.ctx.location.hash,returnTo);
 // Google callback keeps owner intent, while normal customer login never inherits it.
 e=await environment({hash:'#/owner'});await e.click('social-google');let u=new URL(e.state.oauth.options.redirectTo);assert.equal(new URLSearchParams(u.hash.split('?')[1]).get('next'),'#/owner');
 e=await environment({hash:u.hash,search:u.search,user:{id:'owner-1'},profile:{display_name:'Owner',account_type:'owner'}});assert.equal(e.ctx.location.hash,'#/owner');
 e=await environment({hash:'#/login',user:{id:'owner-1'},profile:{display_name:'Owner',account_type:'owner'}});assert.equal(e.ctx.location.hash,'#/dashboard');
 // Brand-new Google/Apple signup from the owner flow creates a fixed owner role.
 e=await environment({hash:'#/login?next=%23%2Fowner',user:{id:'new-owner',user_metadata:{given_name:'Maja',family_name:'Perić'}},profile:null});
 assert.equal(e.state.profile.account_type,'owner');assert.equal(e.state.profile.display_name,'Maja Perić');
 html=await e.route('#/dashboard');assert.match(html,/YOUR OWNER SPACE/);assert.match(html,/My boats/);assert.doesNotMatch(html,/Everything you need for your next day at sea|Profile essentials|My bookings/);
 assert.doesNotMatch(html.match(/<header class="member-header">([\s\S]*?)<\/header>/)?.[1]||'',/Explore boats|How it works/);
 html=await e.route('#/account?tab=information');assert.match(html,/Owner account/);assert.match(html,/Personal profile/);assert.match(html,/Business & verification/);assert.match(html,/Security/);assert.doesNotMatch(html,/href="#\/account\?tab=payouts"|Owner verification/);
 html=await e.route('#/account?tab=business');assert.match(html,/data-live-form="owner-business"/);assert.match(html,/data-live-form="owner-payouts"/);assert.match(html,/data-live-form="owner-document"/);assert.match(html,/data-live-form="owner-submit"/);assert.match(html,/France · SIRET/);assert.match(html,/Business website \(required\)/);assert.equal((html.match(/PUBLISHING REQUIREMENTS/g)||[]).length,1);assert.match(html,/data-live="owner-jump"/);
 html=await e.route('#/owner?edit=new');assert.match(html,/You can save a draft now/);assert.match(html,/name="published"[^>]*disabled/);
 const ownerPdf={size:2400,type:'application/pdf'};
 await e.submit('owner-business',{business_country:'FR',legal_business_name:'Bateaux SARL',tax_identifier:'12345678901234',business_website:'https://bateaux.example',registered_address:'12 Quai de Paris, Marseille, France'});
 assert.equal(e.state.ownerRequest.business_country,'FR');assert.equal(e.state.ownerRequest.application_state,'draft');assert.equal(e.state.uploads.length,0);
 html=await e.route('#/account?tab=payouts');assert.match(html,/data-live-form="owner-payouts"/);assert.match(html,/Automated payouts are not yet active/);
 await e.submit('owner-payouts',{iban:'FR7630006000011234567890189',iban_holder:'Bateaux SARL'});assert.equal(e.state.ownerRequest.iban_holder,'Bateaux SARL');
 html=await e.route('#/account?tab=verification');assert.match(html,/data-live-form="owner-document"/);assert.match(html,/Missing/);assert.match(html,/disabled/);
 for(const [kind,values] of [['registration',{}],['identity',{identity_type:'passport'}],['iban',{}]])await e.submit('owner-document',{...values,document_file:ownerPdf},{document:kind});
 assert.equal(e.state.uploads.length,3);assert.equal(e.state.ownerRequest.identity_type,'passport');assert.equal(e.state.ownerRequest.application_state,'draft');
 html=await e.route('#/account?tab=verification');assert.match(html,/Uploaded/);assert.doesNotMatch(html,/Submit for review<\/button>[^<]*<p class="member-note">Complete/);
 await e.submit('owner-submit',{documents_own:'on'});assert.equal(e.state.ownerRequest.application_state,'submitted');assert.ok(e.state.ownerRequest.submitted_at);
 const pendingOwnerRequest=e.state.ownerRequest;
 html=await e.route('#/account?tab=verification');assert.match(html,/Pending staff review/);
 let reviewer=await environment({hash:'#/staff',user:{id:'reviewer-1'},profile:{display_name:'Maja Perić',account_type:'owner'},ownerRequest:pendingOwnerRequest,staff:true});
 html=await reviewer.route('#/staff');assert.match(html,/Business \/ owner verification/);assert.match(html,/Bateaux SARL/);assert.match(html,/View Registration/);
 await reviewer.submit('owner-review',{status:'approved',registration_matches:'on',identity_matches:'on',bank_matches:'on',note:''},{id:'new-owner'});
 assert.equal(reviewer.state.ownerReview.status,'approved');assert.equal(reviewer.state.deletions.length,0);
 let verifiedOwner=await environment({hash:'#/owner?edit=new',user:{id:'new-owner'},profile:{display_name:'Maja Perić',account_type:'owner'},ownerRequest:pendingOwnerRequest,ownerReview:reviewer.state.ownerReview});
 html=await verifiedOwner.route('#/owner?edit=new');assert.doesNotMatch(html,/name="published"[^>]*disabled/);
 html=await verifiedOwner.route('#/account?tab=verification');assert.match(html,/Your business is approved/);assert.match(html,/class="verification-badge approved">Verified/);
 // Editing a single approved field returns the application to draft without new uploads.
 await verifiedOwner.submit('owner-business',{business_country:'FR',legal_business_name:'Bateaux SARL',tax_identifier:'12345678901234',business_website:'https://newcompany.example',registered_address:'12 Quai de Paris, Marseille, France'});
 assert.equal(verifiedOwner.state.uploads.length,0);assert.equal(verifiedOwner.state.ownerRequest.application_state,'draft');
 html=await verifiedOwner.route('#/owner?edit=new');assert.match(html,/You can save a draft now/);
 const changedOwnerRequest={...pendingOwnerRequest,business_website:'https://newcompany.example'};
 let changedOwner=await environment({hash:'#/owner?edit=new',user:{id:'new-owner'},profile:{display_name:'Maja Perić',account_type:'owner'},ownerRequest:changedOwnerRequest,ownerReview:reviewer.state.ownerReview});
 html=await changedOwner.route('#/owner?edit=new');assert.match(html,/You can save a draft now/);
 html=await e.route('#/listing/boat-1');assert.match(html,/Owner account · bookings unavailable/);assert.doesNotMatch(html,/data-live-form="request"|Save to favourites/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2',skipper:'without'},{id:'boat-1'});
 assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);assert.match(e.feedback.textContent,/Owner accounts cannot rent boats/);
 await e.submit('profile',{first_name:'Maja',last_name:'Perić'},{accountType:'customer',next:'#/bookings'});assert.equal(e.state.profile.account_type,'owner');assert.match(e.feedback.textContent,/Account roles cannot be changed/);
 html=await e.route('#/bookings');assert.match(html,/Owner accounts cannot rent boats/);
 html=await e.route('#/owner');assert.match(html,/Your listings/);
 // Google supplies a full name: a customer profile is created without an extra form.
 e=await environment({hash:'#/dashboard',user:{id:'google-user',user_metadata:{given_name:'Luka',family_name:'Kovač'}},profile:null});
 assert.equal(e.state.profile.account_type,'customer');assert.equal(e.state.profile.display_name,'Luka Kovač');
 assert.equal(e.state.profile.details.first_name,'Luka');assert.equal(e.state.profile.details.last_name,'Kovač');
 html=await e.route('#/dashboard');assert.match(html,/Welcome aboard/);assert.doesNotMatch(html,/Finish signing up/);
 // Apple's web OAuth may provide no name: preserve the customer account and ask once.
 e=await environment({hash:'#/dashboard',user:{id:'apple-user',user_metadata:{}},profile:null});
 assert.equal(e.state.profile.account_type,'customer');assert.equal(e.state.profile.display_name,'');
 html=await e.route('#/dashboard');assert.match(html,/name="first_name"/);assert.match(html,/name="last_name"/);
 await e.submit('profile',{first_name:'Ema',last_name:'Novak'},{accountType:'customer',next:'#/dashboard'});
 assert.equal(e.state.profile.display_name,'Ema Novak');html=await e.route('#/dashboard');assert.doesNotMatch(html,/Finish signing up/);
 // OAuth metadata must never replace a name someone has already edited.
 e=await environment({hash:'#/dashboard',user:{id:'existing-user',user_metadata:{given_name:'Other',family_name:'Name'}},profile:{display_name:'My Chosen Name',account_type:'customer',details:{first_name:'My',last_name:'Chosen Name'}}});
 assert.equal(e.state.profile.display_name,'My Chosen Name');assert.equal(e.state.profile.details.first_name,'My');
 // Unsafe external destinations are not followed.
 e=await environment({hash:'#/login?next=https%3A%2F%2Fevil.invalid',user:{id:'guest-1'},profile:{display_name:'Guest',account_type:'customer'}});assert.equal(e.ctx.location.hash,'#/dashboard');
 // A valid customer account does NOT require a licence upload, but booking does.
 const verifiedUser={id:'guest-1',email:'guest@example.invalid'};
 const verifiedProfile={id:'guest-1',display_name:'Ana Marin',account_type:'customer',details:{first_name:'Ana',last_name:'Marin'}};
 e=await environment({hash:'#/listing/boat-1',user:verifiedUser,profile:verifiedProfile});
 html=await e.route('#/dashboard');assert.match(html,/ID & boat licence/);
 html=await e.route('#/listing/boat-1');assert.match(html,/Licence verification required/);assert.match(html,/Verification required<\/button>/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2',skipper:'without'},{id:'boat-1'});
 assert.equal(e.ctx.location.hash,'#/account?tab=verification');assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);
 html=await e.route('#/account?tab=verification');assert.match(html,/ID card \/ passport image or PDF/);assert.match(html,/boat driving licence/i);
 const pdf={size:2400,type:'application/pdf'};
 await e.submit('verification',{identity_type:'passport',identity_file:pdf,licence_file:pdf,licence_type:'coastal',licence_expiry:'2028-12-31',birth_date:'1992-02-04',documents_own:'on'});
 assert.equal(e.state.uploads.length,2);assert.equal(e.state.verificationRequest.identity_type,'passport');
 html=await e.route('#/listing/boat-1');assert.match(html,/Pending staff review/);assert.match(html,/Verification required<\/button>/);
 // An authorised reviewer checks the ID and skipper licence, then records a decision.
 e=await environment({hash:'#/staff',user:verifiedUser,profile:verifiedProfile,request:e.state.verificationRequest,staff:true});
 html=await e.route('#/staff');assert.match(html,/Staff verification/);assert.match(html,/Approve documents/);assert.match(html,/View ID \/ passport/);
 await e.submit('review',{status:'approved',identity_matches:'on',licence_matches:'on',note:''},{id:'guest-1'});
 assert.equal(e.state.verificationReview.status,'approved');assert.equal(e.state.deletions.length,2);
 // A verified customer can book; changing the account name invalidates the approval.
 e=await environment({hash:'#/listing/boat-1',user:verifiedUser,profile:verifiedProfile,request:e.state.verificationRequest,review:e.state.verificationReview});
 html=await e.route('#/listing/boat-1');assert.match(html,/data-skipper-verification hidden/);assert.match(html,/Send booking request<\/button>/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2',skipper:'without'},{id:'boat-1'});
 assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,1);
 await e.submit('details',{first_name:'Different',last_name:'Name'},{section:'information'});
 html=await e.route('#/listing/boat-1');assert.match(html,/Licence verification required/);
 // A customer with no verification can rent WITH a skipper, but not without one.
 e=await environment({hash:'#/listing/boat-1',user:verifiedUser,profile:verifiedProfile,boatOptions:{with_skipper:true,without_skipper:true}});
 html=await e.route('#/listing/boat-1');assert.match(html,/Rent with skipper/);assert.match(html,/Rent without skipper/);assert.match(html,/name="skipper"/);
 assert.match(html,/value="with" selected/);assert.match(html,/data-skipper-verification hidden/);assert.match(html,/Send booking request/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2',skipper:'with'},{id:'boat-1',withSkipper:'true',withoutSkipper:'true'});
 assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,1);assert.equal(e.state.writes.at(-1).value.with_skipper,true);
 html=await e.route('#/listing/boat-1?skipper=without');assert.match(html,/data-skipper-verification\s*>/);assert.match(html,/Verification required<\/button>/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2',skipper:'without'},{id:'boat-1',withSkipper:'true',withoutSkipper:'true'});
 assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,1);
 // The browser refuses a mode not offered by the boat, even with tampered form data.
 e=await environment({hash:'#/listing/boat-1',user:verifiedUser,profile:verifiedProfile,boatOptions:{with_skipper:false,without_skipper:true}});
 html=await e.route('#/listing/boat-1');assert.doesNotMatch(html,/<option value="with"/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2',skipper:'with'},{id:'boat-1',withSkipper:'false',withoutSkipper:'true'});
 assert.match(e.feedback.textContent,/does not offer/);assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);
 // Owners must select at least one option, and both values are saved to the listing.
 e=await environment({hash:'#/owner?edit=boat-1',user:{id:'owner-1'},profile:{display_name:'Owner',account_type:'owner'}});
 html=await e.route('#/owner?edit=boat-1');assert.match(html,/Available rental options/);
 await e.submit('boat',{name:'Boat',country:'Croatia',location:'Split',type:'Motorboat',price:'800',guests:'6',cabins:'1',description:'',photo:null});
 assert.match(e.feedback.textContent,/at least one rental option/);assert.equal(e.state.writes.filter(x=>x.table==='boats').length,0);
 await e.submit('boat',{name:'Boat',country:'Croatia',location:'Split',type:'Motorboat',price:'800',guests:'6',cabins:'1',description:'',photo:null,with_skipper:'on',without_skipper:'on'});
 assert.equal(e.state.writes.filter(x=>x.table==='boats').length,1);assert.equal(e.state.writes.at(-1).value.with_skipper,true);assert.equal(e.state.writes.at(-1).value.without_skipper,true);
 await e.submit('boat',{name:'Boat',country:'Croatia',location:'Split',type:'Motorboat',price:'800',guests:'6',cabins:'1',description:'',photo:null,with_skipper:'on',without_skipper:'on',skipper_fee_per_day:'120'});
 assert.equal(e.state.writes.at(-1).value.skipper_fee_per_day,120);
 await e.submit('boat',{name:'Boat',country:'Croatia',location:'Split',type:'Motorboat',price:'800',guests:'6',cabins:'1',description:'',photo:null,with_skipper:'on',skipper_fee_per_day:'200'});
 assert.equal(e.state.writes.at(-1).value.skipper_fee_per_day,0);
 e=await environment({hash:'#/listing/boat-1',user:verifiedUser,profile:verifiedProfile,boatOptions:{with_skipper:true,without_skipper:true,skipper_fee_per_day:120}});
 html=await e.route('#/listing/boat-1');assert.match(html,/data-skipper-fee="120"/);assert.match(html,/data-skipper-extra="true"/);
 console.log('PASS: customer/owner journeys, secure staff verification, no-skipper licence gate, skipper bookings without renter documents, rejected unavailable modes, and owner rental options.');
})().catch(e=>{console.error(e);process.exitCode=1});
