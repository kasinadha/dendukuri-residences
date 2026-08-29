-- Building C/D revenue tracking, payment destination accounts (QR/UPI mapping),
-- and expense payer attribution.

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  upi_id text,
  upi_qr_url text,
  building_wing text check (building_wing is null or building_wing in ('C', 'D')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.payment_accounts (code, label, sort_order, notes)
values
  ('joint', 'Joint account', 1, 'Shared Canara / joint receiving account'),
  ('kasi', 'Kasi', 2, 'Kasinadha account'),
  ('kanthu', 'Kanthu', 3, 'Kanthu account'),
  ('pratyu', 'Pratyu', 4, 'Pratyu account')
on conflict (code) do nothing;

alter table public.payments
  add column if not exists receiver_account_id uuid references public.payment_accounts (id);

alter table public.payment_submissions
  add column if not exists receiver_account_id uuid references public.payment_accounts (id);

alter table public.water_tankers
  add column if not exists payer_account_id uuid references public.payment_accounts (id);

alter table public.maintenance_requests
  add column if not exists payer_account_id uuid references public.payment_accounts (id);

alter table public.flats
  add column if not exists payment_account_id uuid references public.payment_accounts (id);

create index if not exists payments_receiver_account_id_idx
  on public.payments (receiver_account_id);

create index if not exists payment_submissions_receiver_account_id_idx
  on public.payment_submissions (receiver_account_id);

create index if not exists water_tankers_payer_account_id_idx
  on public.water_tankers (payer_account_id);

create index if not exists maintenance_requests_payer_account_id_idx
  on public.maintenance_requests (payer_account_id);

create index if not exists payment_accounts_upi_id_idx
  on public.payment_accounts (lower(upi_id))
  where upi_id is not null;

comment on table public.payment_accounts is
  'Owner bank/UPI accounts. Map flats or QR codes here to auto-tag where rent was received or who paid an expense.';

comment on column public.payments.receiver_account_id is
  'Which owner account received this payment (from QR/UPI mapping or manual selection).';

comment on column public.water_tankers.payer_account_id is
  'Which owner account paid for this tanker delivery.';
