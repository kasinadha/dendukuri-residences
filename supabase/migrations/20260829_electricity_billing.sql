-- Electricity billing runs (building meter + per-flat readings with formula).

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
  created_at timestamptz not null default now(),
  unique (billing_month, reading_date)
);

create table if not exists public.electricity_readings (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references public.flats (id) on delete cascade,
  billing_run_id uuid references public.electricity_billing_runs (id) on delete set null,
  reading_date date not null,
  previous_reading numeric not null default 0,
  current_reading numeric not null default 0,
  flat_units numeric,
  common_share_units numeric,
  sanctioned_kw numeric not null default 2,
  energy_charge numeric,
  basic_charge numeric,
  service_charge_amount numeric,
  bill_amount numeric,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.electricity_readings
  add column if not exists billing_run_id uuid references public.electricity_billing_runs (id) on delete set null,
  add column if not exists flat_units numeric,
  add column if not exists common_share_units numeric,
  add column if not exists sanctioned_kw numeric default 2,
  add column if not exists energy_charge numeric,
  add column if not exists basic_charge numeric,
  add column if not exists service_charge_amount numeric;

alter table public.electricity_billing_runs
  add column if not exists basic_charge_per_kw numeric default 120;

-- Legacy column name from earlier draft (safe to ignore if unused).
alter table public.electricity_billing_runs
  add column if not exists basic_charge_per_2kw numeric;

create index if not exists electricity_readings_flat_date_idx
  on public.electricity_readings (flat_id, reading_date desc);

create index if not exists electricity_readings_billing_run_idx
  on public.electricity_readings (billing_run_id);

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
