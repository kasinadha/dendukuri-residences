-- Per-flat UPI QR uploads (admin) and public read for pay page.

drop policy if exists payment_proofs_flat_qr_select on storage.objects;
create policy payment_proofs_flat_qr_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'flat-qr'
  );

drop policy if exists payment_proofs_admin_insert on storage.objects;
create policy payment_proofs_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = 'flat-qr'
      or (storage.foldername(name))[1] = 'public-claims'
    )
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

comment on column public.flats.upi_qr_url is
  'QR image URL/path, or storage path flat-qr/{flat_id}/... in payment-proofs bucket.';
