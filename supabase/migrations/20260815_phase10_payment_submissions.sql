-- Phase 10: tenant UTR payment submissions (admin confirms → receipt)
-- Run in Supabase SQL Editor FIRST among Phase 10 payment files
-- (before 20260815_phase10_payment_proofs.sql, which alters this table).

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies (id),
  billing_month text not null,
  amount numeric not null check (amount > 0),
  payment_date date not null,
  utr text not null,
  upi_id text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  payment_id uuid references public.payments (id),
  submitted_by uuid references auth.users (id),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_submissions_status_idx
  on public.payment_submissions (status, created_at desc);

create index if not exists payment_submissions_tenancy_idx
  on public.payment_submissions (tenancy_id, billing_month);

alter table public.payment_submissions enable row level security;

drop policy if exists payment_submissions_admin_all on public.payment_submissions;
create policy payment_submissions_admin_all
  on public.payment_submissions
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

drop policy if exists payment_submissions_tenant_select on public.payment_submissions;
create policy payment_submissions_tenant_select
  on public.payment_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = payment_submissions.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists payment_submissions_tenant_insert on public.payment_submissions;
create policy payment_submissions_tenant_insert
  on public.payment_submissions
  for insert
  to authenticated
  with check (
    status = 'pending'
    and submitted_by = auth.uid()
    and exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = payment_submissions.tenancy_id
        and tn.profile_id = auth.uid()
        and lower(coalesce(t.status, '')) in ('active', 'occupied', '')
    )
  );
