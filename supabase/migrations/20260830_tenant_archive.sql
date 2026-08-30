-- Archive former tenants so they can be hidden from the admin list
-- without deleting payment / receipt history.

alter table public.tenants
  add column if not exists archived_at timestamptz;

comment on column public.tenants.archived_at is
  'When set, tenant is hidden from admin tenant lists unless show=archived.';

create index if not exists tenants_archived_at_idx
  on public.tenants (archived_at)
  where archived_at is not null;
