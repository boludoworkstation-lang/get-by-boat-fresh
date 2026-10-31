-- Optional technical and insurance information for boat listings.
-- None of these fields is a prerequisite for publishing a verified owner's boat.
alter table public.boats
  add column if not exists specifications jsonb not null default '{}'::jsonb,
  add column if not exists insurance_type text not null default 'not_specified',
  add column if not exists security_deposit numeric(10,2) not null default 0;

alter table public.boats
  add constraint boats_insurance_type_check
    check (insurance_type in ('not_specified', 'none', 'third_party', 'comprehensive')),
  add constraint boats_security_deposit_check
    check (security_deposit >= 0 and security_deposit <= 100000),
  add constraint boats_specifications_shape_check
    check (jsonb_typeof(specifications) = 'object');

create table public.boat_documents (
  boat_id uuid not null references public.boats(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('insurance', 'ownership')),
  storage_path text not null,
  updated_at timestamptz not null default now(),
  primary key (boat_id, document_type),
  constraint boat_documents_owner_path_check check (
    storage_path like owner_id::text || '/' || boat_id::text || '/' || document_type || '/%'
  )
);

create index boat_documents_owner_idx on public.boat_documents(owner_id);
alter table public.boat_documents enable row level security;
revoke all on public.boat_documents from anon, authenticated;
grant select, insert, update, delete on public.boat_documents to authenticated;

create policy boat_documents_read on public.boat_documents for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_verification_staff()));
create policy boat_documents_add on public.boat_documents for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.boats where id = boat_id and owner_id = (select auth.uid())
  ));
create policy boat_documents_edit on public.boat_documents for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.boats where id = boat_id and owner_id = (select auth.uid())
  ));
create policy boat_documents_remove on public.boat_documents for delete to authenticated
  using (owner_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('boat-documents', 'boat-documents', false, 5242880,
  array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy boat_documents_file_add on storage.objects for insert to authenticated
  with check (bucket_id = 'boat-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] in ('insurance', 'ownership')
    and exists (select 1 from public.boats b where b.id::text = (storage.foldername(name))[2]
      and b.owner_id = (select auth.uid())));
create policy boat_documents_file_read on storage.objects for select to authenticated
  using (bucket_id = 'boat-documents' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_verification_staff())));
create policy boat_documents_file_delete on storage.objects for delete to authenticated
  using (bucket_id = 'boat-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
