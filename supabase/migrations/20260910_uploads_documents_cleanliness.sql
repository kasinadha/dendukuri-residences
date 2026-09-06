-- QR image uploads, tenant KYC documents, and maintenance/cleanliness photos.
-- Idempotent. Run in Supabase SQL Editor after 20260909.

-- ---------------------------------------------------------------------------
-- 1. Public bucket for UPI QR images (shown on tenant + public pay pages)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'upi-qr',
  'upi-qr',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists upi_qr_public_select on storage.objects;
create policy upi_qr_public_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'upi-qr');

drop policy if exists upi_qr_admin_insert on storage.objects;
create policy upi_qr_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'upi-qr'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists upi_qr_admin_update on storage.objects;
create policy upi_qr_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'upi-qr'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    bucket_id = 'upi-qr'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists upi_qr_admin_delete on storage.objects;
create policy upi_qr_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'upi-qr'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Private bucket + table for tenant government ID / employment proof
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-documents',
  'tenant-documents',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('government_id', 'employment_proof')),
  id_subtype text,
  file_path text not null,
  original_filename text,
  mime_type text,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, kind)
);

alter table public.tenant_documents drop constraint if exists tenant_documents_id_subtype_check;
alter table public.tenant_documents
  add constraint tenant_documents_id_subtype_check
  check (id_subtype is null or id_subtype in ('aadhaar', 'pan', 'other'));

create index if not exists tenant_documents_tenant_id_idx
  on public.tenant_documents (tenant_id);

comment on table public.tenant_documents is
  'Latest government ID and employment proof per tenant. Files live in private storage tenant-documents.';

alter table public.tenant_documents enable row level security;

drop policy if exists tenant_documents_admin_all on public.tenant_documents;
create policy tenant_documents_admin_all
  on public.tenant_documents
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists tenant_documents_tenant_select on public.tenant_documents;
create policy tenant_documents_tenant_select
  on public.tenant_documents
  for select
  to authenticated
  using (
    exists (
      select 1 from public.tenants tn
      where tn.id = tenant_documents.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists tenant_documents_tenant_insert on public.tenant_documents;
create policy tenant_documents_tenant_insert
  on public.tenant_documents
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.tenants tn
      where tn.id = tenant_documents.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists tenant_documents_tenant_update on public.tenant_documents;
create policy tenant_documents_tenant_update
  on public.tenant_documents
  for update
  to authenticated
  using (
    exists (
      select 1 from public.tenants tn
      where tn.id = tenant_documents.tenant_id
        and tn.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tenants tn
      where tn.id = tenant_documents.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists tenant_documents_tenant_delete on public.tenant_documents;
create policy tenant_documents_tenant_delete
  on public.tenant_documents
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.tenants tn
      where tn.id = tenant_documents.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.tenant_documents from anon';
  end if;
  execute 'revoke all on table public.tenant_documents from public';
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on table public.tenant_documents to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on table public.tenant_documents to service_role';
  end if;
end $$;

-- Path: {auth.uid()}/...
drop policy if exists tenant_documents_storage_insert on storage.objects;
create policy tenant_documents_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists tenant_documents_storage_select_own on storage.objects;
create policy tenant_documents_storage_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists tenant_documents_storage_update_own on storage.objects;
create policy tenant_documents_storage_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists tenant_documents_storage_delete_own on storage.objects;
create policy tenant_documents_storage_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists tenant_documents_storage_admin_select on storage.objects;
create policy tenant_documents_storage_admin_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Private photos on maintenance / cleanliness reports
-- ---------------------------------------------------------------------------

alter table public.maintenance_requests
  add column if not exists photo_paths text[] not null default '{}';

comment on column public.maintenance_requests.photo_paths is
  'Storage object paths in bucket maintenance-photos.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos',
  'maintenance-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists maintenance_photos_tenant_insert on storage.objects;
create policy maintenance_photos_tenant_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'maintenance-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists maintenance_photos_tenant_select on storage.objects;
create policy maintenance_photos_tenant_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'maintenance-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists maintenance_photos_admin_select on storage.objects;
create policy maintenance_photos_admin_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'maintenance-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );
