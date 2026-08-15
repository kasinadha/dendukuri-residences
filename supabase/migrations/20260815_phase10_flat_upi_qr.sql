-- Per-flat UPI / QR for tenant rent payments
-- Run in Supabase SQL Editor.

alter table public.flats
  add column if not exists upi_id text,
  add column if not exists upi_qr_url text;

comment on column public.flats.upi_id is 'UPI VPA for this flat (e.g. 9492883721-2@ybl). Falls back to NEXT_PUBLIC_RENT_UPI_ID.';
comment on column public.flats.upi_qr_url is 'Optional QR image URL/path (e.g. /upi/default-receive-qr.png). If empty, QR is generated from upi_id.';

-- ---------------------------------------------------------------------------
-- OPTIONAL (not part of schema migrate): set the same UPI + QR on ALL flats.
-- Paste only the UPDATE below into Supabase → SQL Editor → Run.
-- ---------------------------------------------------------------------------
-- update public.flats
-- set upi_id = '9492883721-2@ybl',
--     upi_qr_url = '/upi/default-receive-qr.png';
