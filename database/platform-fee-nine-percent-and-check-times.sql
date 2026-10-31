-- Owner price is the amount the owner receives. The customer pays a 9%
-- platform commission plus the estimated card-processing allowance.
-- Historical bookings keep the totals recorded when they were created.
create or replace function private.fee(amount numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(amount * 0.09, 2)
$$;

alter table public.boats
  add column if not exists check_in_time time without time zone not null default '09:00',
  add column if not exists check_out_time time without time zone not null default '19:00';
