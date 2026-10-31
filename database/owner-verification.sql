-- Business verification for boat owners. Apply after verification.sql.
-- Owners may draft listings; publishing a new listing requires a current staff approval.
-- Existing published listings are grandfathered to avoid taking down live bookings.

create table if not exists public.owner_verification_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_country text not null check (business_country ~ '^[A-Z]{2}$'),
  legal_business_name text not null check (length(btrim(legal_business_name)) between 2 and 180),
  tax_identifier text not null check (length(btrim(tax_identifier)) between 3 and 80),
  registered_address text not null check (length(btrim(registered_address)) between 6 and 350),
  business_website text not null check (length(business_website) between 10 and 300 and business_website ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'),
  iban text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  iban_holder text not null check (length(btrim(iban_holder)) between 2 and 180),
  identity_type text not null check (identity_type in ('id_card','passport')),
  registration_path text not null check (length(registration_path) <= 240),
  identity_path text not null check (length(identity_path) <= 240),
  iban_proof_path text not null check (length(iban_proof_path) <= 240),
  submitted_at timestamptz not null default now(),
  constraint owner_fr_siret check (business_country <> 'FR' or tax_identifier ~ '^[0-9]{14}$'),
  constraint owner_hr_oib check (business_country <> 'HR' or tax_identifier ~ '^[0-9]{11}$'),
  constraint owner_registration_folder check (registration_path like user_id::text || '/registration/%' and registration_path !~ '[[:space:]]'),
  constraint owner_identity_folder check (identity_path like user_id::text || '/identity/%' and identity_path !~ '[[:space:]]'),
  constraint owner_iban_folder check (iban_proof_path like user_id::text || '/iban/%' and iban_proof_path !~ '[[:space:]]'),
  constraint owner_distinct_files check (registration_path <> identity_path and registration_path <> iban_proof_path and identity_path <> iban_proof_path)
);
create index if not exists owner_verification_submitted_idx on public.owner_verification_requests (submitted_at desc);
alter table public.owner_verification_requests enable row level security;
revoke all on public.owner_verification_requests from anon, authenticated;
grant select, insert, update on public.owner_verification_requests to authenticated;
create policy owner_verification_read on public.owner_verification_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_verification_staff()));
create policy owner_verification_add on public.owner_verification_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = user_id and p.account_type = 'owner'));
create policy owner_verification_edit on public.owner_verification_requests for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = user_id and p.account_type = 'owner'));

create table if not exists public.owner_verification_reviews (
  user_id uuid primary key references public.owner_verification_requests(user_id) on delete cascade,
  status text not null check (status in ('approved','rejected')),
  note text not null default '' check (length(note) <= 1000),
  reviewed_name text not null,
  reviewed_request jsonb not null,
  reviewer_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now()
);
alter table public.owner_verification_reviews enable row level security;
revoke all on public.owner_verification_reviews from anon, authenticated;
grant select, insert, update on public.owner_verification_reviews to authenticated;
create policy owner_review_read on public.owner_verification_reviews for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_verification_staff()));
create policy owner_review_add on public.owner_verification_reviews for insert to authenticated
  with check ((select private.is_verification_staff()));
create policy owner_review_edit on public.owner_verification_reviews for update to authenticated
  using ((select private.is_verification_staff())) with check ((select private.is_verification_staff()));

create or replace function private.stamp_owner_verification_review()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v public.owner_verification_requests; p public.profiles;
begin
  if not private.is_verification_staff() then raise exception 'Staff review access required'; end if;
  select * into v from public.owner_verification_requests where user_id = new.user_id;
  if not found then raise exception 'Owner verification request missing'; end if;
  select * into p from public.profiles where id = v.user_id;
  if not found or p.account_type <> 'owner' or length(btrim(p.display_name)) < 3 then
    raise exception 'Valid boat owner profile required';
  end if;
  if new.status = 'approved' and (
    not exists(select 1 from storage.objects where bucket_id = 'owner-verification-documents' and name = v.registration_path)
    or not exists(select 1 from storage.objects where bucket_id = 'owner-verification-documents' and name = v.identity_path)
    or not exists(select 1 from storage.objects where bucket_id = 'owner-verification-documents' and name = v.iban_proof_path)
  ) then raise exception 'Registration, identity and business bank documents must be uploaded'; end if;
  new.reviewed_name := btrim(p.display_name);
  new.reviewed_request := to_jsonb(v) - 'submitted_at';
  new.reviewer_id := auth.uid();
  new.reviewed_at := now();
  return new;
end $$;
revoke execute on function private.stamp_owner_verification_review() from public, anon, authenticated;
drop trigger if exists stamp_owner_verification_review on public.owner_verification_reviews;
create trigger stamp_owner_verification_review before insert or update on public.owner_verification_reviews
for each row execute function private.stamp_owner_verification_review();

-- A review ceases to be current whenever any verified field, file path or legal name changes.
create or replace function private.has_approved_owner_verification(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owner_verification_requests v
    join public.owner_verification_reviews r on r.user_id = v.user_id
    join public.profiles p on p.id = v.user_id
    where v.user_id = p_owner and p.account_type = 'owner' and r.status = 'approved'
      and r.reviewed_request = to_jsonb(v) - 'submitted_at'
      and lower(btrim(r.reviewed_name)) = lower(btrim(p.display_name))
  );
$$;
revoke execute on function private.has_approved_owner_verification(uuid) from public, anon, authenticated;

create or replace function private.require_approved_owner_to_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Preserve existing published listings, including edits, while owners are onboarded.
  if tg_op = 'UPDATE' and old.published and new.published then return new; end if;
  if new.published and not private.has_approved_owner_verification(new.owner_id) then
    raise exception 'Owner verification is required before publishing. Open My profile > Owner verification.';
  end if;
  return new;
end $$;
revoke execute on function private.require_approved_owner_to_publish() from public, anon, authenticated;
drop trigger if exists require_approved_owner_to_publish on public.boats;
create trigger require_approved_owner_to_publish before insert or update of published on public.boats
for each row execute function private.require_approved_owner_to_publish();

-- Staff members can see an applicant's legal name without publicising private profiles.
create policy owner_verification_staff_profile_read on public.profiles for select to authenticated
  using ((select private.is_verification_staff()) and exists (
    select 1 from public.owner_verification_requests v where v.user_id = profiles.id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('owner-verification-documents','owner-verification-documents',false,5242880,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;
create policy owner_documents_add on storage.objects for insert to authenticated
with check (bucket_id = 'owner-verification-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('registration','identity','iban'));
create policy owner_documents_read on storage.objects for select to authenticated
using (bucket_id = 'owner-verification-documents'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_verification_staff())));
create policy owner_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'owner-verification-documents' and (
  (select private.is_verification_staff()) or (
    (storage.foldername(name))[1] = (select auth.uid())::text and not exists (
      select 1 from public.owner_verification_requests v
      where v.user_id = (select auth.uid())
        and name in (v.registration_path,v.identity_path,v.iban_proof_path)
    )
  )
));
