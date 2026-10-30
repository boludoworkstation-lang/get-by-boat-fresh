-- Skipper-dependent booking verification. Run once on the production Supabase database.
-- Existing boats remain bareboat-only; existing bookings remain bareboat.
alter table public.boats
  add column if not exists with_skipper boolean not null default false,
  add column if not exists without_skipper boolean not null default true;

alter table public.bookings
  add column if not exists with_skipper boolean not null default false;

alter table public.boats
  add constraint boats_at_least_one_rental_mode check (with_skipper or without_skipper);

create or replace function private.require_offered_rental_mode()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists (
    select 1 from public.boats b where b.id = new.boat_id
      and ((new.with_skipper and b.with_skipper) or (not new.with_skipper and b.without_skipper))
  ) then
    raise exception 'This boat does not offer the selected skipper option';
  end if;
  return new;
end$$;

drop trigger if exists require_offered_rental_mode on public.bookings;
create trigger require_offered_rental_mode before insert on public.bookings
for each row execute function private.require_offered_rental_mode();

-- Only skip customer-document checks for an actual skipper booking.
-- The independent rental-mode trigger above ensures that the boat offers it.
create or replace function private.require_verified_boat_licence()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' and (new.status<>'awaiting_payment' or new.status=old.status) then return new; end if;
  if new.with_skipper then return new; end if;
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
    raise exception 'A verified identity and boat driving licence are required to rent without a skipper. Open My profile > Verification.';
  end if;
  return new;
end$$;

revoke execute on function private.require_offered_rental_mode() from public,anon,authenticated;
revoke execute on function private.require_verified_boat_licence() from public,anon,authenticated;

notify pgrst, 'reload schema';
