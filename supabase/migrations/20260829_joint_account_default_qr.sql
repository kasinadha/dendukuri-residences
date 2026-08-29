-- Default Joint account QR for all flats that do not have their own receive QR.

update public.payment_accounts
set
  upi_qr_url = '/upi/default-receive-qr.png',
  updated_at = now()
where code = 'joint'
  and (upi_qr_url is null or trim(upi_qr_url) = '');

comment on column public.payment_accounts.upi_qr_url is
  'Static receive QR image path or URL. Joint account QR is the site-wide default when a flat has no UPI/QR set.';
