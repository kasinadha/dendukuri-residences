-- Phase 11: rent payment status fields + sequential receipt numbers DR-YYYY-NNNN
-- Run in Supabase SQL Editor. Idempotent where possible.
-- Does NOT create payments for confirmed/reserved (e.g. D201).

-- 1) Amount due on payments (for partial/pending status)
alter table public.payments
  add column if not exists amount_due numeric(12,2);

comment on column public.payments.amount_due is
  'Amount due for this billing period (usually monthly rent). Used with amount_paid for status.';

-- Backfill amount_due from amount_paid where missing (historical full payments)
update public.payments
set amount_due = amount_paid
where amount_due is null
  and amount_paid is not null;

-- 2) Payment status check: pending | partial | paid | overdue | waived
alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (
    status is null
    or lower(status) in (
      'pending',
      'partial',
      'paid',
      'overdue',
      'waived',
      'completed', -- legacy alias if any rows exist
      'success'
    )
  );

-- 3) Sequential receipt numbers: DR-2026-0001
create table if not exists public.receipt_number_counters (
  year integer primary key,
  last_value integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.allocate_receipt_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer;
  n integer;
begin
  y := extract(year from (timezone('Asia/Kolkata', now())))::integer;

  insert into public.receipt_number_counters as c (year, last_value)
  values (y, 1)
  on conflict (year) do update
    set last_value = c.last_value + 1,
        updated_at = now()
  returning last_value into n;

  return 'DR-' || y::text || '-' || lpad(n::text, 4, '0');
end;
$$;

revoke all on function public.allocate_receipt_number() from public;
grant execute on function public.allocate_receipt_number() to authenticated;

comment on function public.allocate_receipt_number() is
  'Allocates next unique receipt number DR-YYYY-NNNN for the Asia/Kolkata calendar year.';

-- Seed counter from existing sequential-style numbers if present (best effort)
do $$
declare
  y integer := extract(year from (timezone('Asia/Kolkata', now())))::integer;
  max_n integer;
begin
  select coalesce(max(
    nullif(substring(receipt_number from 'DR-' || y::text || '-([0-9]+)$'), '')::integer
  ), 0)
  into max_n
  from public.receipts
  where receipt_number ~ ('^DR-' || y::text || '-[0-9]+$');

  if max_n > 0 then
    insert into public.receipt_number_counters (year, last_value)
    values (y, max_n)
    on conflict (year) do update
      set last_value = greatest(public.receipt_number_counters.last_value, excluded.last_value);
  end if;
end $$;

-- 4) RLS reminder (do not weaken tenant write restrictions)
-- Admin policies should already allow insert/select on payments + receipts.
-- Tenants: SELECT own receipts only; NO write on payments.
-- Verify with:
--   select polname, cmd, qual from pg_policies where tablename in ('payments','receipts');
