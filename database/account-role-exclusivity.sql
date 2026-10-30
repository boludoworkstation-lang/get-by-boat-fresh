-- Get By Boat: choose customer OR boat owner on first signup, never both.
-- Apply after schema.sql and verification.sql. No existing account roles are changed.

-- The previous ALL policy also allowed people to delete their profile and re-create
-- it as a different role. Allow only self-read, self-create and self-edit.
drop policy if exists profile_self on public.profiles;
drop policy if exists profile_self_read on public.profiles;
drop policy if exists profile_self_add on public.profiles;
drop policy if exists profile_self_edit on public.profiles;

create policy profile_self_read on public.profiles for select to authenticated
  using(id=(select auth.uid()));
create policy profile_self_add on public.profiles for insert to authenticated
  with check(id=(select auth.uid()));
create policy profile_self_edit on public.profiles for update to authenticated
  using(id=(select auth.uid())) with check(id=(select auth.uid()));
revoke delete on public.profiles from authenticated;

create or replace function private.keep_account_role_fixed()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.account_type is distinct from old.account_type then
    raise exception 'Account role cannot be changed. Create a separate account for the other role.';
  end if;
  return new;
end;
$$;

drop trigger if exists keep_account_role_fixed on public.profiles;
create trigger keep_account_role_fixed before update of account_type on public.profiles
  for each row execute function private.keep_account_role_fixed();

-- Only customers can create a rental booking (in addition to the existing
-- manual ID/passport + boat licence verification checks).
drop policy if exists booking_add on public.bookings;
create policy booking_add on public.bookings for insert to authenticated
  with check (
    customer_id=(select auth.uid())
    and exists (
      select 1 from public.profiles
      where id=(select auth.uid()) and account_type='customer'
    )
  );

create or replace function private.require_customer_for_booking()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id=(select auth.uid())
      and id=new.customer_id
      and account_type='customer'
  ) then
    raise exception 'Only customer accounts can book boats. Boat owners cannot rent.';
  end if;
  return new;
end;
$$;

drop trigger if exists require_customer_for_booking on public.bookings;
create trigger require_customer_for_booking before insert on public.bookings
  for each row execute function private.require_customer_for_booking();
