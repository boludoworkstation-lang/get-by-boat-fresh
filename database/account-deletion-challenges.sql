-- Private-to-service account deletion challenge records (no browser Data API access).
create table if not exists public.account_deletion_challenges (
  user_id uuid primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 20),
  window_started_at timestamptz not null default now(),
  window_count integer not null default 1 check (window_count between 1 and 100)
);
alter table public.account_deletion_challenges enable row level security;
revoke all on public.account_deletion_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.account_deletion_challenges to service_role;
