-- Get By Boat: keep legacy IBAN payouts and support local bank accounts
-- for registered businesses in the United States, Australia and Bahamas.
-- Approval snapshots created before this column remain valid until details change.
alter table public.owner_verification_requests
  add column if not exists payout_bank_details jsonb;

alter table public.owner_verification_requests
  add constraint owner_payout_bank_details_valid check (
    payout_bank_details is null or coalesce((
      jsonb_typeof(payout_bank_details) = 'object'
      and (payout_bank_details->>'country') in ('HR','GR','ES','FR','IT','PT','CY','TR','MT','AU','ME','AL','US','BS')
      and (
        (
          payout_bank_details->>'method' = 'iban'
          and payout_bank_details->>'country' not in ('US','AU','BS')
          and iban is not null
          and left(iban,2) = payout_bank_details->>'country'
        ) or (
          payout_bank_details->>'method' = 'local'
          and payout_bank_details->>'country' in ('US','AU','BS')
          and iban is null
          and payout_bank_details->>'account_number' ~ '^[A-Za-z0-9-]{4,34}$'
          and (
            (payout_bank_details->>'country' = 'US' and payout_bank_details->>'routing_number' ~ '^[0-9]{9}$')
            or (payout_bank_details->>'country' = 'AU' and payout_bank_details->>'routing_number' ~ '^[0-9]{6}$')
            or (payout_bank_details->>'country' = 'BS' and payout_bank_details->>'routing_number' ~ '^[A-Z0-9-]{2,80}$')
          )
          and (
            coalesce(payout_bank_details->>'swift_bic','') = ''
            or payout_bank_details->>'swift_bic' ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'
          )
          and (
            payout_bank_details->>'country' <> 'BS'
            or length(coalesce(payout_bank_details->>'swift_bic','')) in (8,11)
          )
        )
      )
    ), false)
  );

alter table public.owner_verification_requests
  drop constraint if exists owner_complete_submission;

alter table public.owner_verification_requests
  add constraint owner_complete_submission check (
    application_state = 'draft' or (
      business_country is not null
      and legal_business_name is not null
      and tax_identifier is not null
      and registered_address is not null
      and business_website is not null
      and iban_holder is not null
      and (
        iban is not null
        or (
          payout_bank_details->>'method' = 'local'
          and payout_bank_details->>'country' in ('US','AU','BS')
          and payout_bank_details->>'account_number' is not null
          and payout_bank_details->>'routing_number' is not null
        )
      )
      and identity_type is not null
      and registration_path is not null
      and identity_path is not null
      and iban_proof_path is not null
      and submitted_at is not null
    )
  );

-- Existing approved reviews lack the newly added nullable JSONB key.
-- Treat them as current only while the corresponding new field stays NULL.
create or replace function private.has_approved_owner_verification(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owner_verification_requests v
    join public.owner_verification_reviews r on r.user_id = v.user_id
    join public.profiles p on p.id = v.user_id
    where v.user_id = p_owner and p.account_type = 'owner'
      and v.application_state = 'submitted' and r.status = 'approved'
      and (
        r.reviewed_request = to_jsonb(v) - 'application_state'
        or (
          v.payout_bank_details is null
          and not (r.reviewed_request ? 'payout_bank_details')
          and r.reviewed_request = to_jsonb(v) - 'application_state' - 'payout_bank_details'
        )
      )
      and lower(btrim(r.reviewed_name)) = lower(btrim(p.display_name))
  );
$$;
revoke execute on function private.has_approved_owner_verification(uuid)
  from public, anon, authenticated;
