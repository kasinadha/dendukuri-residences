-- Track deposit refunds on vacate / transfer.

alter table public.tenancies
  add column if not exists deposit_returned numeric,
  add column if not exists deposit_returned_date date;

comment on column public.tenancies.deposit_returned is
  'Total advance/deposit returned to tenant (not monthly rent).';
comment on column public.tenancies.deposit_returned_date is
  'Date of most recent deposit refund.';
