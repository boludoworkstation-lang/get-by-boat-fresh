-- Public availability exposes dates only, never guest or owner booking details.
create or replace function public.public_boat_availability(p_boat uuid)
returns table(start_date date, end_date date)
language sql stable security definer set search_path = ''
as $$
  select x.start_date, x.end_date
  from public.boat_blocks x
  where x.boat_id = p_boat
    and exists (select 1 from public.boats b where b.id = p_boat and b.published)
  union all
  select r.start_date, r.end_date
  from public.bookings r
  where r.boat_id = p_boat and r.status in ('awaiting_payment', 'confirmed')
    and exists (select 1 from public.boats b where b.id = p_boat and b.published);
$$;
revoke all on function public.public_boat_availability(uuid) from public;
grant execute on function public.public_boat_availability(uuid) to anon, authenticated, service_role;

-- Exactly one immutable rating per finished, confirmed reservation.
create table if not exists public.owner_reviews (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  boat_id uuid not null references public.boats(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1500),
  created_at timestamptz not null default now(),
  constraint no_self_reviews check (owner_id <> customer_id)
);
create index if not exists owner_reviews_owner_created_idx on public.owner_reviews(owner_id, created_at desc);
create index if not exists owner_reviews_customer_idx on public.owner_reviews(customer_id);
alter table public.owner_reviews enable row level security;
revoke all on public.owner_reviews from public, anon, authenticated;
grant select on public.owner_reviews to anon, authenticated;
grant insert on public.owner_reviews to authenticated;

create policy owner_reviews_read on public.owner_reviews for select to anon, authenticated
  using (
    customer_id = (select auth.uid()) or owner_id = (select auth.uid())
    or exists (select 1 from public.boats b where b.id = boat_id and b.published)
  );

create policy owner_reviews_after_trip on public.owner_reviews for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.bookings r
      join public.boats b on b.id = r.boat_id
      where r.id = owner_reviews.booking_id
        and r.customer_id = (select auth.uid())
        and r.customer_id = owner_reviews.customer_id
        and r.status = 'confirmed'
        and r.end_date < current_date
        and b.id = owner_reviews.boat_id
        and b.owner_id = owner_reviews.owner_id
        and b.owner_id <> (select auth.uid())
    )
  );
