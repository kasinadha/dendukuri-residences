-- Phase 1 (RFE 2 + RFE 3): money CHECKs, unique live UTR, electricity uniqueness,
-- payments.billing_month, payment_allocations for arrears split, soft-void status.
-- Idempotent. Does not delete existing rows. CHECKs are NOT VALID so historical
-- rows that already violate them are left in place; new writes are enforced.

-- ---------------------------------------------------------------------------
-- 1. payments.billing_month (backfill from notes)
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists billing_month text;

update public.payments
set billing_month = substring(notes from 'billing_month:([0-9]{4}-[0-9]{2})')
where billing_month is null
  and notes ~ 'billing_month:[0-9]{4}-[0-9]{2}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_billing_month_chk'
  ) then
    alter table public.payments
      add constraint payments_billing_month_chk
      check (billing_month is null or billing_month ~ '^[0-9]{4}-[0-9]{2}$')
      not valid;
  end if;
end $$;

comment on column public.payments.billing_month is
  'YYYY-MM this payment is attributed to. Arrears splits also write payment_allocations.';

-- ---------------------------------------------------------------------------
-- 2. Amount CHECKs (non-negative). Waived rows may have amount_paid = 0.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_amount_paid_nonneg_chk'
  ) then
    alter table public.payments
      add constraint payments_amount_paid_nonneg_chk
      check (amount_paid is null or amount_paid >= 0)
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'payments_amount_due_nonneg_chk'
  ) then
    alter table public.payments
      add constraint payments_amount_due_nonneg_chk
      check (amount_due is null or amount_due >= 0)
      not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Soft-void status
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_status_check;
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
      'voided',
      'completed',
      'success'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Unique live UTR (skip if duplicates already exist)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'payments_utr_live_uidx'
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.payments
    where transaction_reference is not null
      and btrim(transaction_reference) <> ''
      and lower(coalesce(status, '')) <> 'voided'
    group by lower(btrim(transaction_reference))
    having count(*) > 1
  ) then
    raise notice 'Skipping payments_utr_live_uidx because duplicate live UTRs exist.';
    return;
  end if;

  execute $idx$
    create unique index payments_utr_live_uidx
      on public.payments (lower(btrim(transaction_reference)))
      where transaction_reference is not null
        and btrim(transaction_reference) <> ''
        and lower(coalesce(status, '')) <> 'voided'
  $idx$;
end $$;

-- ---------------------------------------------------------------------------
-- 5. payment_allocations — split one collected payment across months
-- ---------------------------------------------------------------------------
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  billing_month text not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint payment_allocations_month_chk
    check (billing_month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint payment_allocations_amount_chk
    check (amount > 0),
  constraint payment_allocations_payment_month_key
    unique (payment_id, billing_month)
);

create index if not exists payment_allocations_month_idx
  on public.payment_allocations (billing_month);

alter table public.payment_allocations enable row level security;

drop policy if exists payment_allocations_admin_all on public.payment_allocations;
create policy payment_allocations_admin_all
  on public.payment_allocations
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

drop policy if exists payment_allocations_tenant_select on public.payment_allocations;
create policy payment_allocations_tenant_select
  on public.payment_allocations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payments pay
      join public.tenancies t on t.id = pay.tenancy_id
      join public.tenants tn on tn.id = t.tenant_id
      where pay.id = payment_allocations.payment_id
        and tn.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Electricity: one reading per flat per run; current >= previous
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'electricity_readings_monotonic_chk'
  ) then
    alter table public.electricity_readings
      add constraint electricity_readings_monotonic_chk
      check (current_reading >= previous_reading)
      not valid;
  end if;
end $$;

create unique index if not exists electricity_readings_run_flat_uidx
  on public.electricity_readings (billing_run_id, flat_id)
  where billing_run_id is not null;

-- ---------------------------------------------------------------------------
-- 7. One pending name-change per tenant+field (skip if duplicates exist)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'tenant_change_requests_pending_uidx'
  ) then
    return;
  end if;

  if to_regclass('public.tenant_change_requests') is null then
    return;
  end if;

  if exists (
    select 1
    from public.tenant_change_requests
    where status = 'pending'
    group by tenant_id, field
    having count(*) > 1
  ) then
    raise notice 'Skipping tenant_change_requests_pending_uidx because duplicates exist.';
    return;
  end if;

  execute $idx$
    create unique index tenant_change_requests_pending_uidx
      on public.tenant_change_requests (tenant_id, field)
      where status = 'pending'
  $idx$;
end $$;

-- ---------------------------------------------------------------------------
-- 8. One reading per flat per date; one billing run per wing per month
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'electricity_readings_flat_date_uidx'
  ) then
    null;
  elsif exists (
    select 1
    from public.electricity_readings
    where flat_id is not null
      and reading_date is not null
    group by flat_id, reading_date
    having count(*) > 1
  ) then
    raise notice 'Skipping electricity_readings_flat_date_uidx because duplicates exist.';
  else
    execute $idx$
      create unique index electricity_readings_flat_date_uidx
        on public.electricity_readings (flat_id, reading_date)
    $idx$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.electricity_billing_runs') is null then
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'electricity_billing_runs'
      and column_name = 'building_wing'
  ) then
    return;
  end if;
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'electricity_billing_runs_month_wing_uidx'
  ) then
    return;
  end if;
  if exists (
    select 1
    from public.electricity_billing_runs
    group by billing_month, building_wing
    having count(*) > 1
  ) then
    raise notice 'Skipping electricity_billing_runs_month_wing_uidx because duplicates exist.';
    return;
  end if;
  execute $idx$
    create unique index electricity_billing_runs_month_wing_uidx
      on public.electricity_billing_runs (billing_month, building_wing)
  $idx$;
end $$;
