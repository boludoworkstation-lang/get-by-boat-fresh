-- Owner account UX: save business details, payout details and individual files
-- before formally submitting for staff approval. Run AFTER owner-verification.sql.
-- Previously submitted records remain submitted; no documents or reviews are deleted.

alter table public.owner_verification_requests
  add column if not exists application_state text not null default 'submitted'
  check (application_state in ('draft','submitted'));
alter table public.owner_verification_requests
  alter column application_state set default 'draft',
  alter column business_country drop not null,
  alter column legal_business_name drop not null,
  alter column tax_identifier drop not null,
  alter column registered_address drop not null,
  alter column business_website drop not null,
  alter column iban drop not null,
  alter column iban_holder drop not null,
  alter column identity_type drop not null,
  alter column registration_path drop not null,
  alter column identity_path drop not null,
  alter column iban_proof_path drop not null,
  alter column submitted_at drop not null,
  alter column submitted_at drop default;

alter table public.owner_verification_requests
  add constraint owner_complete_submission check (
    application_state = 'draft' or (
      business_country is not null and legal_business_name is not null
      and tax_identifier is not null and registered_address is not null
      and business_website is not null and iban is not null
      and iban_holder is not null and identity_type is not null
      and registration_path is not null and identity_path is not null
      and iban_proof_path is not null and submitted_at is not null
    )
  );

-- The application state itself is excluded from snapshots; the submission time
-- is included so a rejected submission can be resubmitted without re-uploading.
create or replace function private.stamp_owner_verification_review()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v public.owner_verification_requests; p public.profiles;
begin
  if not private.is_verification_staff() then raise exception 'Staff review access required'; end if;
  select * into v from public.owner_verification_requests where user_id = new.user_id;
  if not found or v.application_state <> 'submitted' then
    raise exception 'The owner must submit a completed application before review';
  end if;
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
  new.reviewed_request := to_jsonb(v) - 'application_state';
  new.reviewer_id := auth.uid();
  new.reviewed_at := now();
  return new;
end $$;
revoke execute on function private.stamp_owner_verification_review() from public, anon, authenticated;

create or replace function private.has_approved_owner_verification(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owner_verification_requests v
    join public.owner_verification_reviews r on r.user_id = v.user_id
    join public.profiles p on p.id = v.user_id
    where v.user_id = p_owner and p.account_type = 'owner'
      and v.application_state = 'submitted' and r.status = 'approved'
      and r.reviewed_request = to_jsonb(v) - 'application_state'
      and lower(btrim(r.reviewed_name)) = lower(btrim(p.display_name))
  );
$$;
revoke execute on function private.has_approved_owner_verification(uuid) from public, anon, authenticated;
