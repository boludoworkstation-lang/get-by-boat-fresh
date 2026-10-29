-- Manual customer verification. Run after schema.sql and account-dashboard.sql.
-- Identity files remain in a PRIVATE bucket; reviewers should delete them promptly after review.

create table if not exists private.verification_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on private.verification_staff from public, anon, authenticated;

-- The confirmed, existing Get By Boat Site owner may review submissions.
-- Future staff must be added by a privileged administrator, never by browser-side code.
insert into private.verification_staff(user_id)
select id from auth.users where lower(email)='pj.scouting@gmail.com' and email_confirmed_at is not null
on conflict do nothing;

create or replace function private.is_verification_staff()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from private.verification_staff where user_id=(select auth.uid()))$$;
revoke all on function private.is_verification_staff() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_verification_staff() to authenticated;

create or replace function public.is_verification_staff()
returns boolean language sql stable security invoker set search_path=''
as $$select private.is_verification_staff()$$;
revoke all on function public.is_verification_staff() from public,anon;
grant execute on function public.is_verification_staff() to authenticated;

create table if not exists public.verification_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  identity_type text not null check(identity_type in ('id_card','passport')),
  identity_path text not null check(length(identity_path)<=240),
  licence_path text not null check(length(licence_path)<=240),
  licence_type text not null check(licence_type in ('coastal','offshore','inland','professional','other')),
  licence_expiry date,
  birth_date date not null check(birth_date < current_date),
  submitted_at timestamptz not null default now(),
  constraint identity_folder check(identity_path like user_id::text || '/identity/%' and identity_path !~ '[[:space:]]'),
  constraint licence_folder check(licence_path like user_id::text || '/licence/%' and licence_path !~ '[[:space:]]'),
  constraint different_documents check(identity_path <> licence_path)
);
create index if not exists verification_requests_submitted_idx on public.verification_requests(submitted_at desc);
alter table public.verification_requests enable row level security;
revoke all on public.verification_requests from anon,authenticated;
grant select,insert,update on public.verification_requests to authenticated;
create policy verification_request_read on public.verification_requests for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_verification_staff()));
create policy verification_request_add on public.verification_requests for insert to authenticated
with check(user_id=(select auth.uid()));
create policy verification_request_edit on public.verification_requests for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.verification_reviews (
  user_id uuid primary key references public.verification_requests(user_id) on delete cascade,
  status text not null check(status in ('approved','rejected')),
  note text not null default '' check(length(note)<=1000),
  reviewed_name text not null check(length(reviewed_name)<=120),
  reviewed_birth_date date not null,
  identity_path text not null,
  licence_path text not null,
  reviewed_licence_type text not null,
  reviewed_licence_expiry date,
  reviewer_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now()
);
alter table public.verification_reviews enable row level security;
revoke all on public.verification_reviews from anon,authenticated;
grant select,insert,update on public.verification_reviews to authenticated;
create policy verification_review_read on public.verification_reviews for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_verification_staff()));
create policy verification_review_add on public.verification_reviews for insert to authenticated
with check((select private.is_verification_staff()));
create policy verification_review_edit on public.verification_reviews for update to authenticated
using((select private.is_verification_staff())) with check((select private.is_verification_staff()));

-- Review snapshots are set by the database, not supplied by the staff browser.
create or replace function private.stamp_verification_review()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v public.verification_requests; p public.profiles;
begin
  if not private.is_verification_staff() then raise exception 'Staff review access required'; end if;
  select * into v from public.verification_requests where user_id=new.user_id for update;
  if not found then raise exception 'Verification request missing'; end if;
  select * into p from public.profiles where id=v.user_id;
  if not found or length(btrim(p.display_name))<3 then raise exception 'Customer name missing'; end if;
  if nullif(p.details->>'birth_date','') is not null and (p.details->>'birth_date')<>v.birth_date::text then
    raise exception 'Customer profile date of birth must match the submitted ID';
  end if;
  if new.status='approved' and v.licence_expiry is not null and v.licence_expiry < current_date then
    raise exception 'The boat licence has expired';
  end if;
  if new.status='approved' and (not exists(select 1 from storage.objects
      where bucket_id='verification-documents' and name=v.identity_path)
    or not exists(select 1 from storage.objects
      where bucket_id='verification-documents' and name=v.licence_path)) then
    raise exception 'Both documents must be uploaded before approval';
  end if;
  new.reviewed_name:=btrim(p.display_name);
  new.reviewed_birth_date:=v.birth_date;
  new.identity_path:=v.identity_path;
  new.licence_path:=v.licence_path;
  new.reviewed_licence_type:=v.licence_type;
  new.reviewed_licence_expiry:=v.licence_expiry;
  new.reviewer_id:=auth.uid();
  new.reviewed_at:=now();
  return new;
end$$;
drop trigger if exists stamp_verification_review on public.verification_reviews;
create trigger stamp_verification_review before insert or update on public.verification_reviews
for each row execute function private.stamp_verification_review();

-- Staff can see applicant profiles, but only after a customer submits a review request.
create policy verification_staff_profile_read on public.profiles for select to authenticated
using((select private.is_verification_staff()) and exists(
  select 1 from public.verification_requests v where v.user_id=profiles.id
));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('verification-documents','verification-documents',false,5242880,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false, file_size_limit=5242880,
  allowed_mime_types=excluded.allowed_mime_types;
create policy verification_document_add on storage.objects for insert to authenticated
with check(bucket_id='verification-documents'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[2] in ('identity','licence'));
create policy verification_document_read on storage.objects for select to authenticated
using(bucket_id='verification-documents'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_verification_staff())));
create policy verification_document_delete on storage.objects for delete to authenticated
using(bucket_id='verification-documents'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_verification_staff())));

-- Critical booking check: this rule also applies to direct REST/API requests.
create or replace function private.require_verified_boat_licence()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' and (new.status<>'awaiting_payment' or new.status=old.status) then return new; end if;
  if not exists(
    select 1 from public.verification_requests v
    join public.verification_reviews r on r.user_id=v.user_id
    join public.profiles p on p.id=v.user_id
    where v.user_id=new.customer_id
      and r.status='approved'
      and r.identity_path=v.identity_path and r.licence_path=v.licence_path
      and r.reviewed_birth_date=v.birth_date
      and r.reviewed_licence_type=v.licence_type
      and r.reviewed_licence_expiry is not distinct from v.licence_expiry
      and lower(btrim(r.reviewed_name))=lower(btrim(p.display_name))
      and (nullif(p.details->>'birth_date','') is null or (p.details->>'birth_date')=v.birth_date::text)
      and (v.licence_expiry is null or v.licence_expiry>=new.end_date)
  ) then
    raise exception 'A verified identity and boat driving licence are required before booking. Open My profile > Verifications.';
  end if;
  return new;
end$$;
drop trigger if exists require_verified_boat_licence on public.bookings;
create trigger require_verified_boat_licence before insert or update of status on public.bookings
for each row execute function private.require_verified_boat_licence();

revoke all on all functions in schema private from public,anon;
-- Only the boolean staff-check helper is callable by authenticated users.
revoke execute on function private.stamp_verification_review() from public,anon,authenticated;
revoke execute on function private.require_verified_boat_licence() from public,anon,authenticated;
