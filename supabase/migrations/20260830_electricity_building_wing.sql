-- Per-wing (Building C / D) electricity billing runs.

alter table public.electricity_billing_runs
  add column if not exists building_wing text;

update public.electricity_billing_runs
set building_wing = 'C'
where building_wing is null or building_wing = '';

alter table public.electricity_billing_runs
  alter column building_wing set default 'C';

alter table public.electricity_billing_runs
  drop constraint if exists electricity_billing_runs_billing_month_reading_date_key;

drop index if exists electricity_billing_runs_month_date_wing_uidx;

create unique index electricity_billing_runs_month_date_wing_uidx
  on public.electricity_billing_runs (billing_month, reading_date, building_wing);

alter table public.electricity_billing_runs
  drop constraint if exists electricity_billing_runs_building_wing_check;

alter table public.electricity_billing_runs
  add constraint electricity_billing_runs_building_wing_check
  check (building_wing in ('C', 'D'));

comment on column public.electricity_billing_runs.building_wing is
  'Building C or D — building meter and common-area share are per wing.';
