-- Common-area CCTV cameras for tenant + admin live view.
-- Idempotent. Service role still bypasses RLS.

create table if not exists public.cameras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  stream_mode text not null default 'hikconnect'
    check (stream_mode in ('hikconnect', 'hls', 'link')),
  device_serial text,
  channel_no integer not null default 1 check (channel_no >= 1),
  hls_url text,
  share_url text,
  tenant_visible boolean not null default true,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cameras_sort_idx
  on public.cameras (sort_order, name);

alter table public.cameras enable row level security;

drop policy if exists cameras_admin_all on public.cameras;
create policy cameras_admin_all
  on public.cameras
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

drop policy if exists cameras_tenant_select on public.cameras;
create policy cameras_tenant_select
  on public.cameras
  for select
  to authenticated
  using (
    enabled
    and tenant_visible
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'tenant'
        and coalesce(p.is_active, true)
    )
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.cameras from anon';
  end if;
  execute 'revoke all on table public.cameras from public';
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on table public.cameras to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on table public.cameras to service_role';
  end if;
end $$;

comment on table public.cameras is
  'Common-area Hik-Connect / HLS cameras. Tenants see enabled + tenant_visible only.';
