-- Keep precise meeting details out of the public boats API.
-- Transfer existing records before clearing legacy public columns.
alter table public.boats
  add column if not exists city_map_lat numeric(4,1),
  add column if not exists city_map_lng numeric(4,1),
  add column if not exists licence_required boolean not null default true,
  add column if not exists minimum_rental_age smallint not null default 18
    check (minimum_rental_age between 18 and 100);

create table if not exists public.boat_pickups (
  boat_id uuid primary key references public.boats(id) on delete cascade,
  pickup_address text not null check (char_length(pickup_address) between 1 and 240),
  latitude numeric(9,6),
  longitude numeric(9,6),
  updated_at timestamptz not null default now(),
  constraint pickup_coordinate_pair check ((latitude is null) = (longitude is null)),
  constraint pickup_coordinates_valid check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

alter table public.boat_pickups enable row level security;
revoke all on public.boat_pickups from public, anon, authenticated;
grant select, insert, update on public.boat_pickups to authenticated;

create policy boat_pickup_owner_select on public.boat_pickups
  for select to authenticated
  using (exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=(select auth.uid())));
create policy boat_pickup_paid_customer_select on public.boat_pickups
  for select to authenticated
  using (exists(select 1 from public.bookings k where k.boat_id=boat_id
    and k.customer_id=(select auth.uid()) and k.status='confirmed'));
create policy boat_pickup_owner_insert on public.boat_pickups
  for insert to authenticated
  with check (exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=(select auth.uid())));
create policy boat_pickup_owner_update on public.boat_pickups
  for update to authenticated
  using (exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=(select auth.uid())))
  with check (exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=(select auth.uid())));

insert into public.boat_pickups(boat_id,pickup_address,latitude,longitude)
select id,coalesce(nullif(trim(pickup_location),''),location),pickup_latitude,pickup_longitude
from public.boats
on conflict(boat_id) do nothing;

update public.boats set
  city_map_lat=round(pickup_latitude::numeric,1),
  city_map_lng=round(pickup_longitude::numeric,1)
where pickup_latitude is not null and pickup_longitude is not null;

-- These columns remain for backwards compatibility but must never expose data.
update public.boats
  set pickup_location=null,pickup_latitude=null,pickup_longitude=null
where pickup_location is not null or pickup_latitude is not null or pickup_longitude is not null;

alter table public.boats
  add constraint no_public_pickup_details
  check (pickup_location is null and pickup_latitude is null and pickup_longitude is null);

-- Any new precise pin updates the coarsened public map centre only.
create or replace function private.update_public_city_map()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.latitude is not null and new.longitude is not null then
    update public.boats
    set city_map_lat=round(new.latitude::numeric,1),
        city_map_lng=round(new.longitude::numeric,1)
    where id=new.boat_id;
  end if;
  return new;
end $$;
revoke execute on function private.update_public_city_map() from public, anon, authenticated;
create trigger update_public_city_map
after insert or update of latitude,longitude on public.boat_pickups
for each row execute function private.update_public_city_map();

-- Bareboat rentals that are legally licence-free do not require licence review.
create or replace function private.require_verified_boat_licence()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' and (new.status<>'awaiting_payment' or new.status=old.status) then return new; end if;
  if new.with_skipper then return new; end if;
  if exists(select 1 from public.boats b where b.id=new.boat_id and not b.licence_required) then return new; end if;
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
end $$;
revoke execute on function private.require_verified_boat_licence() from public,anon,authenticated;
