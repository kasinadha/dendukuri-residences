-- Vacate + internal transfer requests.
-- Idempotent. Run in Supabase SQL Editor.

create table if not exists public.vacate_requests (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies (id),
  status text not null default 'pending',
  reason text,
  created_at timestamptz not null default now()
);

alter table public.vacate_requests
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists request_type text not null default 'vacate',
  add column if not exists preferred_flat_number text,
  add column if not exists target_flat_id uuid references public.flats (id);

alter table public.vacate_requests
  drop constraint if exists vacate_requests_type_check;

alter table public.vacate_requests
  add constraint vacate_requests_type_check
  check (request_type in ('vacate', 'transfer'));

alter table public.vacate_requests
  drop constraint if exists vacate_requests_status_check;

alter table public.vacate_requests
  add constraint vacate_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'completed'));

create index if not exists vacate_requests_tenancy_idx
  on public.vacate_requests (tenancy_id, created_at desc);

alter table public.vacate_requests enable row level security;

drop policy if exists vacate_requests_admin_all on public.vacate_requests;
create policy vacate_requests_admin_all
  on public.vacate_requests
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

drop policy if exists vacate_requests_tenant_select on public.vacate_requests;
create policy vacate_requests_tenant_select
  on public.vacate_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = vacate_requests.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists vacate_requests_tenant_insert on public.vacate_requests;
create policy vacate_requests_tenant_insert
  on public.vacate_requests
  for insert
  to authenticated
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = vacate_requests.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );
