-- Phase 10b: payment proof screenshots (tenant upload → admin review)
-- PREREQUISITE: run 20260815_phase10_payment_submissions.sql first (creates public.payment_submissions).
-- Ordered Phase 10 paste list for Supabase SQL Editor:
--   1) 20260815_phase10_payment_submissions.sql
--   2) 20260815_phase10_payment_proofs.sql  (this file)
--   3) 20260815_phase10_flat_upi_qr.sql      (independent; any order OK)

do $$
begin
  if to_regclass('public.payment_submissions') is null then
    raise exception
      'public.payment_submissions does not exist. Run 20260815_phase10_payment_submissions.sql first, then re-run this file.';
  end if;
end $$;

alter table public.payment_submissions
  add column if not exists proof_path text;

comment on column public.payment_submissions.proof_path is
  'Storage object path in bucket payment-proofs (not a public URL).';

-- Private bucket for UTR / UPI confirmation screenshots
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Tenants may upload into their own folder: {auth.uid()}/...
drop policy if exists payment_proofs_tenant_insert on storage.objects;
create policy payment_proofs_tenant_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Tenants may read / replace / delete only their own objects
drop policy if exists payment_proofs_tenant_select on storage.objects;
create policy payment_proofs_tenant_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists payment_proofs_tenant_update on storage.objects;
create policy payment_proofs_tenant_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists payment_proofs_tenant_delete on storage.objects;
create policy payment_proofs_tenant_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins may read all payment proofs
drop policy if exists payment_proofs_admin_select on storage.objects;
create policy payment_proofs_admin_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );
