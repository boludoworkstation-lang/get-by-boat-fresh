create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '' check(length(display_name)<=120), account_type text not null default 'customer' check(account_type in ('customer','owner')), created_at timestamptz not null default now());
create table public.boats(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null check(length(name) between 1 and 120),country text not null,location text not null,type text not null check(type in ('Motorboat','RIB','Sailboat','Catamaran','Yacht','Jetski')),price numeric(12,2) not null check(price>0 and price<=100000),guests integer not null check(guests between 1 and 100),cabins integer not null default 0 check(cabins>=0),description text not null default '' check(length(description)<=10000),photo_url text, published boolean not null default false,with_skipper boolean not null default false,without_skipper boolean not null default true,check(with_skipper or without_skipper),created_at timestamptz not null default now());
create index boats_owner_idx on public.boats(owner_id);
create table public.bookings(id uuid primary key default gen_random_uuid(),boat_id uuid not null references public.boats(id),customer_id uuid not null references auth.users(id),start_date date not null,end_date date not null,guests integer not null check(guests>0),with_skipper boolean not null default false,status text not null default 'pending_owner' check(status in ('pending_owner','awaiting_payment','declined','cancelled','confirmed')),daily_rate numeric(12,2) not null default 0,charter_price numeric(12,2) not null default 0,service_fee numeric(12,2) not null default 0,total numeric(12,2) not null default 0,customer_name text not null check(length(customer_name) between 1 and 120),created_at timestamptz not null default now(),check(end_date>=start_date and end_date-start_date<=365));
create index bookings_boat_idx on public.bookings(boat_id,start_date,end_date);
create index bookings_customer_idx on public.bookings(customer_id,created_at);
create table public.boat_blocks(id uuid primary key default gen_random_uuid(),boat_id uuid not null references public.boats(id),start_date date not null,end_date date not null,check(end_date>=start_date and end_date-start_date<=730));
create index blocks_boat_idx on public.boat_blocks(boat_id,start_date,end_date);
alter table public.profiles enable row level security;
alter table public.boats enable row level security;
alter table public.bookings enable row level security;
alter table public.boat_blocks enable row level security;
revoke all on public.profiles, public.boats, public.bookings, public.boat_blocks from anon, authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.boats to anon,authenticated;
grant insert,update on public.boats to authenticated;
grant select,insert,update on public.bookings to authenticated;
grant select,insert,delete on public.boat_blocks to authenticated;
create policy profile_self on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy boats_read on public.boats for select to anon,authenticated using(published or owner_id=(select auth.uid()));
create policy boats_add on public.boats for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and account_type='owner'));
create policy boats_edit on public.boats for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy booking_read on public.bookings for select to authenticated using(customer_id=(select auth.uid()) or exists(select 1 from public.boats where id=boat_id and owner_id=(select auth.uid())));
create policy booking_add on public.bookings for insert to authenticated with check(customer_id=(select auth.uid()));
create policy booking_edit on public.bookings for update to authenticated using(customer_id=(select auth.uid()) or exists(select 1 from public.boats where id=boat_id and owner_id=(select auth.uid()))) with check(customer_id=(select auth.uid()) or exists(select 1 from public.boats where id=boat_id and owner_id=(select auth.uid())));
create policy blocks_read on public.boat_blocks for select to authenticated using(exists(select 1 from public.boats where id=boat_id and (published or owner_id=(select auth.uid()))));
create policy blocks_add on public.boat_blocks for insert to authenticated with check(exists(select 1 from public.boats where id=boat_id and owner_id=(select auth.uid())));
create policy blocks_remove on public.boat_blocks for delete to authenticated using(exists(select 1 from public.boats where id=boat_id and owner_id=(select auth.uid())));
create function private.fee(amount numeric) returns numeric language sql immutable set search_path='' as $$select round(amount*0.07,2)$$;
-- A private trigger validates identity, transitions and server-calculated prices.
create function private.check_booking() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.boats; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.boat_id::text,0));
 select * into b from public.boats where id=new.boat_id;
 if not found then raise exception 'Boat unavailable';end if;
 if TG_OP='INSERT' then
  if new.customer_id<>actor or b.owner_id=actor or not b.published then raise exception 'Invalid booking request';end if;
  if new.start_date<current_date or new.end_date<new.start_date or new.end_date-new.start_date>365 or new.guests>b.guests then raise exception 'Invalid dates or guest count';end if;
  new.status:='pending_owner';new.daily_rate:=b.price;new.charter_price:=b.price*(new.end_date-new.start_date+1);new.service_fee:=private.fee(new.charter_price);new.total:=new.charter_price+new.service_fee;new.created_at:=now();
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
create trigger check_booking before insert or update on public.bookings for each row execute function private.check_booking();
create function private.require_offered_rental_mode() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.boats b where b.id=new.boat_id and ((new.with_skipper and b.with_skipper) or (not new.with_skipper and b.without_skipper))) then
   raise exception 'This boat does not offer the selected skipper option';
 end if;
 return new;
end$$;
create trigger require_offered_rental_mode before insert on public.bookings for each row execute function private.require_offered_rental_mode();
create function private.check_block() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from public.boats where id=new.boat_id and owner_id=auth.uid()) then raise exception 'Owner access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.boat_id::text,0));
 if exists(select 1 from public.bookings x where x.boat_id=new.boat_id and x.status in ('awaiting_payment','confirmed') and daterange(x.start_date,x.end_date,'[]') && daterange(new.start_date,new.end_date,'[]')) then raise exception 'A reservation already holds these dates';end if;
 return new;
end$$;
create trigger check_block before insert on public.boat_blocks for each row execute function private.check_block();
-- Calendar exposes dates only, never guest details. Private implementation checks visibility.
create function private.availability(p_boat uuid) returns table(start_date date,end_date date) language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.boats where id=p_boat and (published or owner_id=auth.uid())) then return;end if;
 return query select b.start_date,b.end_date from public.boat_blocks b where b.boat_id=p_boat union all select r.start_date,r.end_date from public.bookings r where r.boat_id=p_boat and r.status in ('awaiting_payment','confirmed');
end$$;
create function public.boat_availability(p_boat uuid) returns table(start_date date,end_date date) language sql security invoker set search_path='' as $$select * from private.availability(p_boat)$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.availability(uuid) to authenticated;
revoke all on function public.boat_availability(uuid) from public,anon;
grant execute on function public.boat_availability(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('boat-photos','boat-photos',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy boat_photo_add on storage.objects for insert to authenticated with check(bucket_id='boat-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy boat_photo_read on storage.objects for select to authenticated using(bucket_id='boat-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy boat_photo_delete on storage.objects for delete to authenticated using(bucket_id='boat-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Constraint also protects simultaneous acceptance transactions.
create extension if not exists btree_gist with schema extensions;
set local search_path=public,extensions;
alter table public.bookings add constraint no_overlapping_accepted_bookings exclude using gist (boat_id with =, daterange(start_date,end_date,'[]') with &&) where (status in ('awaiting_payment','confirmed'));
