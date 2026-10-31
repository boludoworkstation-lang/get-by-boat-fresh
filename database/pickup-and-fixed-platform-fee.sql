-- Pickup address for each boat; legacy listings keep working until edited.
alter table public.boats
  add column if not exists pickup_location text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'boats_pickup_location_length' and conrelid = 'public.boats'::regclass) then
    alter table public.boats
      add constraint boats_pickup_location_length
      check (pickup_location is null or length(btrim(pickup_location)) between 1 and 240);
  end if;
end $$;

-- Owner price in public.boats.price is the net payout, not the guest-facing price.
-- The guest pays the owner's net charter price plus a fixed 9% platform fee.
-- Existing booking records and their historical fee amounts are left unchanged.
create or replace function private.fee(amount numeric)
returns numeric
language sql immutable
set search_path = ''
as $$ select round(amount * 0.09, 2) $$;
