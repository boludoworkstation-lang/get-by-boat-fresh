-- Exact marina pickup pin, controlled by the owner in the boat editor.
-- Existing boats remain valid with no coordinates until their owners choose a pin.
alter table public.boats
  add column if not exists pickup_latitude numeric(9,6),
  add column if not exists pickup_longitude numeric(9,6);

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boats_pickup_coordinates_valid'
      and conrelid = 'public.boats'::regclass
  ) then
    alter table public.boats add constraint boats_pickup_coordinates_valid
      check (
        (pickup_latitude is null and pickup_longitude is null)
        or (
          pickup_latitude between -90 and 90
          and pickup_longitude between -180 and 180
        )
      );
  end if;
end $$;
