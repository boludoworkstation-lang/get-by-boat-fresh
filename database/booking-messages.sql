-- Private conversations for bookings. Applied to the Get By Boat Supabase database.
-- Re-running this file is safe; existing chat data and policies are retained.
create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  content text not null check (length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists booking_messages_thread_idx on public.booking_messages(booking_id,created_at,id);
create index if not exists booking_messages_sender_idx on public.booking_messages(sender_id);
create index if not exists booking_messages_unread_idx on public.booking_messages(booking_id,sender_id) where read_at is null;
alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from anon,authenticated;
grant select on public.booking_messages to authenticated;
grant insert(booking_id,sender_id,content) on public.booking_messages to authenticated;
grant update(read_at) on public.booking_messages to authenticated;

drop policy if exists booking_message_participants_read on public.booking_messages;
create policy booking_message_participants_read on public.booking_messages for select to authenticated
using(exists(select 1 from public.bookings b where b.id=booking_id
  and (b.customer_id=(select auth.uid()) or exists(select 1 from public.boats boat where boat.id=b.boat_id and boat.owner_id=(select auth.uid())))));

drop policy if exists booking_message_participants_add on public.booking_messages;
create policy booking_message_participants_add on public.booking_messages for insert to authenticated
with check(sender_id=(select auth.uid()) and exists(select 1 from public.bookings b where b.id=booking_id
  and b.status in ('pending_owner','awaiting_payment','confirmed')
  and (b.customer_id=(select auth.uid()) or exists(select 1 from public.boats boat where boat.id=b.boat_id and boat.owner_id=(select auth.uid())))));

drop policy if exists booking_message_recipient_mark_read on public.booking_messages;
create policy booking_message_recipient_mark_read on public.booking_messages for update to authenticated
using(sender_id<>(select auth.uid()) and exists(select 1 from public.bookings b where b.id=booking_id
  and (b.customer_id=(select auth.uid()) or exists(select 1 from public.boats boat where boat.id=b.boat_id and boat.owner_id=(select auth.uid())))))
with check(sender_id<>(select auth.uid()) and exists(select 1 from public.bookings b where b.id=booking_id
  and (b.customer_id=(select auth.uid()) or exists(select 1 from public.boats boat where boat.id=b.boat_id and boat.owner_id=(select auth.uid())))));

-- Server-only idempotency log for email. Never expose these events to the browser.
create table if not exists public.booking_email_events (
  event_key text primary key,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
alter table public.booking_email_events enable row level security;
revoke all on public.booking_email_events from anon,authenticated;
drop policy if exists booking_email_events_no_client_access on public.booking_email_events;
create policy booking_email_events_no_client_access on public.booking_email_events for all to anon,authenticated
using(false) with check(false);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='booking_messages') then
    alter publication supabase_realtime add table public.booking_messages;
  end if;
end $$;
