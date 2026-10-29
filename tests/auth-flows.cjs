const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('public/app.js','utf8');
const helpers=source.slice(source.indexOf('function rentalDayCount('),source.indexOf('function boatDetail('));
const backend=fs.readFileSync('public/backend.js','utf8');
const sleep=()=>new Promise(r=>setTimeout(r,5));
async function environment({hash='#/login',user=null,profile=null,search='',request=null,review=null,staff=false}={}){
 const state={user,profile,verificationRequest:request,verificationReview:review,staff,writes:[],uploads:[],deletions:[],oauth:null,logins:0};const events={};const feedback={textContent:''};
 const boat={id:'boat-1',owner_id:'owner-1',name:'Test Boat',country:'Croatia',location:'Split',type:'Motorboat',price:800,guests:6,cabins:1,published:true};
 const client={auth:{getUser:async()=>({data:{user:state.user}}),onAuthStateChange(){},signInWithPassword:async()=>{state.logins++;state.user={id:'guest-1'};return {data:{session:{user:state.user}}}},signInWithOAuth:async x=>{state.oauth=x;return {data:{}}},signOut:async()=>{state.user=null;return {data:{}}}},rpc:async(name)=>({data:name==='is_verification_staff'?state.staff:[]}),storage:{from(){return {upload:async(path,file)=>{state.uploads.push({path,file});return {data:{path}}},remove:async paths=>{state.deletions.push(...paths);return {data:paths}},createSignedUrl:async path=>({data:{signedUrl:'https://example.invalid/download/'+path}})}}},from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},update(value){state.writes.push({table,value});if(table==='profiles')state.profile={...state.profile,...value};return q},upsert(value){state.writes.push({table,value});if(table==='profiles')state.profile=value;if(table==='verification_requests')state.verificationRequest=value;if(table==='verification_reviews')state.verificationReview={...value,identity_path:state.verificationRequest.identity_path,licence_path:state.verificationRequest.licence_path,reviewed_birth_date:state.verificationRequest.birth_date,reviewed_licence_type:state.verificationRequest.licence_type,reviewed_licence_expiry:state.verificationRequest.licence_expiry,reviewed_name:state.profile.display_name};return q},insert(value){state.writes.push({table,value});return q},maybeSingle:async()=>({data:table==='profiles'?state.profile:table==='verification_requests'?state.verificationRequest:table==='verification_reviews'?state.verificationReview:null}),single:async()=>({data:table==='verification_requests'?state.verificationRequest:table==='verification_reviews'?state.verificationReview:boat}),then(resolve){resolve({data:table==='boats'?[boat]:table==='verification_requests'&&state.verificationRequest?[state.verificationRequest]:table==='verification_reviews'&&state.verificationReview?[state.verificationReview]:table==='profiles'&&state.profile?[{id:state.user?.id,...state.profile}]:[]})}};return q}};
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
 html=await e.route('#/dashboard');assert.match(html,/member-sidebar/);assert.match(html,/Booking requests/);assert.match(html,/Welcome aboard/);assert.doesNotMatch(html,/<footer|What should we call you/);
 html=await e.route('#/account');assert.match(html,/Personal information/);assert.match(html,/data-live-form="avatar"/);
 html=await e.route('#/account?tab=experience');assert.match(html,/Your boat licences/);
 html=await e.route('#/bookings');assert.doesNotMatch(html,/My boats|Accept request/);
 await e.submit('details',{first_name:'Pere',last_name:'Juran',city:'Split'},{section:'information'});assert.equal(e.state.profile.display_name,'Pere Juran');assert.equal(e.state.profile.details.city,'Split');assert.equal(e.state.profile.account_type,'customer');
 await e.submit('details',{boating_level:'Experienced',licences:['Coastal licence'],bio:'Sailing since childhood.'},{section:'experience'});assert.equal(e.state.profile.details.city,'Split');assert.equal(e.state.profile.details.boating_level,'Experienced');assert.equal(e.state.profile.details.licences[0],'Coastal licence');
 // Existing customer cannot silently become an owner by visiting the owner space.
 html=await e.route('#/owner');assert.match(html,/Continue as boat owner/);assert.match(html,/role="dialog"/);assert.equal(e.state.profile.account_type,'customer');
 await e.submit('profile',{first_name:'Pere',last_name:'Juran'},{accountType:'owner',next:'#/owner'});assert.equal(e.state.profile.account_type,'owner');assert.equal(e.ctx.location.hash,'#/owner');html=await e.route('#/owner');assert.match(html,/Boat owner/);assert.match(html,/My boats/);
 // Owner capabilities survive editing the customer profile.
 await e.submit('profile',{first_name:'Pere',last_name:'Juran'},{accountType:'customer',next:'#/bookings'});assert.equal(e.state.profile.account_type,'owner');assert.equal(e.ctx.location.hash,'#/bookings');
 // A guest's boat, dates and guest count survive email login and profile setup.
 e=await environment({hash:'#/listing/boat-1'});await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'4'},{id:'boat-1'});
 const returnTo=new URLSearchParams(e.ctx.location.hash.split('?')[1]).get('next');assert.match(returnTo,/#\/listing\/boat-1\?start=2027-07-01&end=2027-07-03&guests=4/);assert.equal(e.state.writes.length,0);
 await e.route(e.ctx.location.hash);await e.submit('auth',{email:'guest@example.invalid'});await e.submit('auth',{email:'guest@example.invalid',password:'not-a-real-password'});
 assert.equal(e.ctx.location.hash,returnTo);
 html=await e.route(returnTo);assert.match(html,/value="2027-07-01"/);assert.match(html,/value="2027-07-03"/);assert.match(html,/name="guests" type="number" value="4"/);assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'4'},{id:'boat-1'});
 assert.match(e.ctx.location.hash,/#\/account\?next=/);assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,0);
 html=await e.route(e.ctx.location.hash);assert.match(html,/name="first_name"/);
 await e.submit('profile',{first_name:'New',last_name:'Guest'},{accountType:'customer',next:returnTo});assert.equal(e.ctx.location.hash,returnTo);
 // Google callback keeps owner intent, while normal customer login never inherits it.
 e=await environment({hash:'#/owner'});await e.click('social-google');let u=new URL(e.state.oauth.options.redirectTo);assert.equal(new URLSearchParams(u.hash.split('?')[1]).get('next'),'#/owner');
 e=await environment({hash:u.hash,search:u.search,user:{id:'owner-1'},profile:{display_name:'Owner',account_type:'owner'}});assert.equal(e.ctx.location.hash,'#/owner');
 e=await environment({hash:'#/login',user:{id:'owner-1'},profile:{display_name:'Owner',account_type:'owner'}});assert.equal(e.ctx.location.hash,'#/dashboard');
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
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2'},{id:'boat-1'});
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
 html=await e.route('#/listing/boat-1');assert.doesNotMatch(html,/Licence verification required/);
 await e.submit('request',{start_date:'2027-07-01',end_date:'2027-07-03',guests:'2'},{id:'boat-1'});
 assert.equal(e.state.writes.filter(x=>x.table==='bookings').length,1);
 await e.submit('details',{first_name:'Different',last_name:'Name'},{section:'information'});
 html=await e.route('#/listing/boat-1');assert.match(html,/Licence verification required/);
 console.log('PASS: customer and owner journeys, OAuth identities, account setup, secure document submissions, staff review, mandatory verified licence before booking, and invalidation after name changes.');
})().catch(e=>{console.error(e);process.exitCode=1});
