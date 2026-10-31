-- Future booking totals include a universal processing-cost allowance.
-- The allowance models standard EEA card processing: 1.5% of gross + €0.25
-- per booking, grossed up so the owner's net rate and 7% platform revenue remain.
-- This is part of the quoted booking price for every payment method, not a
-- card-specific surcharge. Actual processor fees can differ; the platform
-- bears that difference. Existing booking totals are deliberately unchanged.
alter table public.bookings
  add column if not exists processing_fee numeric(12,2) not null default 0
    check (processing_fee >= 0);

create or replace function private.processing_allowance(charter numeric)
returns numeric language sql immutable set search_path = ''
as $$
  select case when charter <= 0 then 0::numeric
    else greatest(0::numeric,
      round((charter + private.fee(charter) + 0.25) / 0.985, 2)
       - charter - private.fee(charter))
    end
$$;

create or replace function private.check_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare b public.boats; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.boat_id::text,0));
 select * into b from public.boats where id=new.boat_id;
 if not found then raise exception 'Boat unavailable';end if;
 if TG_OP='INSERT' then
  if new.customer_id<>actor or b.owner_id=actor or not b.published then raise exception 'Invalid booking request';end if;
  if new.start_date<current_date or new.end_date<new.start_date or new.end_date-new.start_date>365 or new.guests>b.guests then raise exception 'Invalid dates or guest count';end if;
  new.status:='pending_owner';new.daily_rate:=b.price;new.charter_price:=b.price*(new.end_date-new.start_date+1);
  new.processing_fee:=private.processing_allowance(new.charter_price);
  new.service_fee:=private.fee(new.charter_price)+new.processing_fee;
  new.total:=new.charter_price+new.service_fee;new.created_at:=now();
 else
  if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'Booking details cannot be modified';end if;
  if new.status=old.status then return new;end if;
  if actor=b.owner_id and old.status='pending_owner' and new.status in ('awaiting_payment','declined') then null;
  elsif actor=old.customer_id and old.status in ('pending_owner','awaiting_payment') and new.status='cancelled' then null;
  else raise exception 'This booking transition is not permitted';end if;
  if new.status='awaiting_payment' and new.start_date<current_date then raise exception 'Dates have passed';end if;
 end if;
 if TG_OP='INSERT' or new.status='awaiting_payment' then
  if exists(select 1 from public.boat_blocks x where x.boat_id=new.boat_id and daterange(x.start_date,x.end_date,'[]') && daterange(new.start_date,new.end_date,'[]')) or exists(select 1 from public.bookings x where x.boat_id=new.boat_id and x.id<>new.id and x.status in ('awaiting_payment','confirmed') and daterange(x.start_date,x.end_date,'[]') && daterange(new.start_date,new.end_date,'[]')) then raise exception 'These dates are no longer available';end if;
 end if;
 return new;
end$$;
