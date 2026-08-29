-- Building / flat scope and payer attribution for operational expenses.

alter table public.water_tankers
  add column if not exists building_wing text
    check (building_wing is null or building_wing in ('C', 'D', 'shared'));

alter table public.water_tankers
  add column if not exists flat_id uuid references public.flats (id);

create index if not exists water_tankers_building_wing_idx
  on public.water_tankers (building_wing);

create index if not exists water_tankers_flat_id_idx
  on public.water_tankers (flat_id);

comment on column public.water_tankers.building_wing is
  'Building C, D, or shared (common to both).';

comment on column public.water_tankers.flat_id is
  'Optional flat when the tanker cost is attributed to one unit.';

create table if not exists public.operational_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  title text not null,
  category text,
  amount numeric not null check (amount >= 0),
  building_wing text check (building_wing in ('C', 'D', 'shared')),
  flat_id uuid references public.flats (id),
  payer_account_id uuid not null references public.payment_accounts (id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists operational_expenses_expense_date_idx
  on public.operational_expenses (expense_date desc);

create index if not exists operational_expenses_building_wing_idx
  on public.operational_expenses (building_wing);

create index if not exists operational_expenses_payer_account_id_idx
  on public.operational_expenses (payer_account_id);

alter table public.operational_expenses enable row level security;

drop policy if exists operational_expenses_admin_all on public.operational_expenses;
create policy operational_expenses_admin_all
  on public.operational_expenses
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

comment on table public.operational_expenses is
  'Misc property expenses (cleaning, supplies, society fees, etc.) with building/flat and payer.';
