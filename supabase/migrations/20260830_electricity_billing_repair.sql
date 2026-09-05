-- One-shot repair for electricity billing (safe to re-run).
-- Paste entire file into Supabase SQL Editor if "Generate bills" asks for migrations.

-- ── 1) Core tables ──────────────────────────────────────────────

create table if not exists public.electricity_billing_runs (
  id uuid primary key default gen_random_uuid(),
  billing_month text not null,
  reading_date date not null,
  building_previous_reading numeric not null default 0,
  building_current_reading numeric not null default 0,
  building_sanctioned_kw numeric not null default 14,
  building_bill_amount numeric,
  rate_per_unit numeric not null default 8,
  basic_charge_per_kw numeric not null default 120,
  service_charge_percent numeric not null default 9,
  occupied_flats_count integer not null default 0,
  common_area_units numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.electricity_readings (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats (id) on delete cascade,
  reading_date date not null,
  previous_reading numeric not null default 0,
  current_reading numeric not null default 0,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.electricity_readings
  add column if not exists billing_run_id uuid,
  add column if not exists flat_units numeric,
  add column if not exists common_share_units numeric,
  add column if not exists sanctioned_kw numeric default 2,
  add column if not exists energy_charge numeric,
  add column if not exists basic_charge numeric,
  add column if not exists service_charge_amount numeric,
  add column if not exists bill_amount numeric;

alter table public.electricity_billing_runs
  add column if not exists basic_charge_per_kw numeric default 120,
  add column if not exists basic_charge_per_2kw numeric,
  add column if not exists building_wing text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'electricity_readings_billing_run_id_fkey'
  ) then
    alter table public.electricity_readings
      add constraint electricity_readings_billing_run_id_fkey
      foreign key (billing_run_id)
      references public.electricity_billing_runs (id)
      on delete set null;
  end if;
end $$;

update public.electricity_billing_runs
set building_wing = 'C'
where building_wing is null or building_wing = '';

alter table public.electricity_billing_runs
  alter column building_wing set default 'C';

-- Drop legacy unique constraints (month+date only) before wing index.
alter table public.electricity_billing_runs
  drop constraint if exists electricity_billing_runs_billing_month_reading_date_key;

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'electricity_billing_runs'
      and c.contype in ('u', 'p')
      and pg_get_constraintdef(c.oid) ilike '%billing_month%'
      and pg_get_constraintdef(c.oid) ilike '%reading_date%'
      and pg_get_constraintdef(c.oid) not ilike '%building_wing%'
  loop
    execute format(
      'alter table public.electricity_billing_runs drop constraint if exists %I',
      r.conname
    );
    raise notice 'Dropped legacy unique constraint %', r.conname;
  end loop;
end $$;

drop index if exists electricity_billing_runs_month_date_wing_uidx;

create unique index if not exists electricity_billing_runs_month_date_wing_uidx
  on public.electricity_billing_runs (billing_month, reading_date, building_wing);

alter table public.electricity_billing_runs
  drop constraint if exists electricity_billing_runs_building_wing_check;

alter table public.electricity_billing_runs
  add constraint electricity_billing_runs_building_wing_check
  check (building_wing in ('C', 'D'));

create index if not exists electricity_readings_flat_date_idx
  on public.electricity_readings (flat_id, reading_date desc);

create index if not exists electricity_readings_billing_run_idx
  on public.electricity_readings (billing_run_id);

-- ── 2) RLS ──────────────────────────────────────────────────────

alter table public.electricity_billing_runs enable row level security;
alter table public.electricity_readings enable row level security;

drop policy if exists electricity_billing_runs_admin_all on public.electricity_billing_runs;
create policy electricity_billing_runs_admin_all
  on public.electricity_billing_runs
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

drop policy if exists electricity_readings_admin_all on public.electricity_readings;
create policy electricity_readings_admin_all
  on public.electricity_readings
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

drop policy if exists electricity_readings_tenant_select on public.electricity_readings;
create policy electricity_readings_tenant_select
  on public.electricity_readings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.flat_id = electricity_readings.flat_id
        and tn.profile_id = auth.uid()
    )
  );

-- Quick check
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'electricity_billing_runs'
      and column_name = 'building_wing'
  ) as has_building_wing;
