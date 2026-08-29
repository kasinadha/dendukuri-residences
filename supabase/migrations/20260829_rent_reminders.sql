-- Rent reminder tracking (admin marks tenant reminded for a billing month).
-- Idempotent. Run in Supabase SQL Editor.

create table if not exists public.rent_reminders (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies (id) on delete cascade,
  billing_month text not null,
  reminded_at timestamptz not null default now(),
  reminded_by uuid references auth.users (id),
  channel text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  unique (tenancy_id, billing_month)
);

create index if not exists rent_reminders_month_idx
  on public.rent_reminders (billing_month, reminded_at desc);

alter table public.rent_reminders enable row level security;

drop policy if exists rent_reminders_admin_all on public.rent_reminders;
create policy rent_reminders_admin_all
  on public.rent_reminders
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

drop policy if exists rent_reminders_tenant_select on public.rent_reminders;
create policy rent_reminders_tenant_select
  on public.rent_reminders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = rent_reminders.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );
