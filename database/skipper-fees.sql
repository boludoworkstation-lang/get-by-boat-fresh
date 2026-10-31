-- Owner-controlled skipper rates. Extra skipper fees are paid directly at check-in,
-- and must never be added to the online charter price or platform commission.
-- For skipper-only boats, the skipper is included in the boat price.

alter table public.boats
  add column if not exists skipper_fee_per_day numeric(10,2) not null default 0
    check (skipper_fee_per_day between 0 and 10000);

alter table public.bookings
  add column if not exists skipper_fee_total numeric(12,2) not null default 0
    check (skipper_fee_total >= 0);

-- Snapshot the fee at booking creation, so future owner price edits cannot
-- change what the guest agreed to pay the skipper at check-in.
create or replace function private.capture_skipper_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  boat public.boats;
begin
  select * into boat from public.boats where id = new.boat_id;
  if not found then
    raise exception 'Boat unavailable';
  end if;

  new.skipper_fee_total := case
    when new.with_skipper and boat.with_skipper and boat.without_skipper
      then boat.skipper_fee_per_day * (new.end_date - new.start_date + 1)
    else 0
  end;

  return new;
end
$$;

revoke execute on function private.capture_skipper_fee()
  from public, anon, authenticated;

drop trigger if exists capture_skipper_fee on public.bookings;
create trigger capture_skipper_fee
  before insert on public.bookings
  for each row execute function private.capture_skipper_fee();

notify pgrst, 'reload schema';
