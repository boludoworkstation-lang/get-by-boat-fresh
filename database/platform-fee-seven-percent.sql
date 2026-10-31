-- All newly created bookings use a 7% platform markup on the owner's rate.
-- Existing bookings retain their already-recorded commission and total.
create or replace function private.fee(amount numeric)
returns numeric language sql immutable set search_path = ''
as $$ select round(amount * 0.07, 2) $$;
