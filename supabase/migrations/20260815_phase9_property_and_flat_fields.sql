-- Phase 9A: property + flat inventory fields + deposit tracking on tenancies
-- Run in Supabase → SQL Editor before CSV import.
-- Does not invent flats/tenants (import script does that separately).

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.flats
  add column if not exists property_id uuid references public.properties (id),
  add column if not exists floor integer,
  add column if not exists maintenance_amount numeric;

alter table public.tenancies
  add column if not exists deposit_amount numeric,
  add column if not exists deposit_paid numeric,
  add column if not exists deposit_paid_date date,
  add column if not exists notes text;

-- Keep security_deposit usable by existing UI; import will mirror deposit_amount → security_deposit.
-- Allow unspecified rent/deposit (e.g. D001) without inventing ₹0.
alter table public.tenancies
  alter column monthly_rent drop not null;

alter table public.tenancies
  alter column security_deposit drop not null;

alter table public.properties enable row level security;

drop policy if exists properties_admin_all on public.properties;
create policy properties_admin_all
  on public.properties
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

insert into public.properties (name)
values ('Dendukuri''s Residences')
on conflict (name) do nothing;
