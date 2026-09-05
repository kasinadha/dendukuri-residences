-- Phase 2: core RLS, revoke anon login-email oracle, protect agreement terms.
-- Idempotent. Service role still bypasses RLS (cron, public-pay admin client).

-- ---------------------------------------------------------------------------
-- 1. resolve_login_email: server/service_role only (H7)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'resolve_login_email'
      and p.pronargs = 1
  ) then
    return;
  end if;

  execute 'revoke all on function public.resolve_login_email(text) from public';
  execute 'revoke all on function public.resolve_login_email(text) from anon';
  execute 'revoke all on function public.resolve_login_email(text) from authenticated';
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.resolve_login_email(text) to service_role';
  end if;
  execute $c$
    comment on function public.resolve_login_email(text) is
      'Maps email or 10-digit mobile to Auth email. Callable only via service_role from a server action.'
  $c$;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tenants cannot change commercial agreement columns (H8)
-- ---------------------------------------------------------------------------
create or replace function public.tenancy_agreements_protect_commercial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.is_active, true)
  ) then
    return NEW;
  end if;

  if NEW.tenancy_id is distinct from OLD.tenancy_id
    or NEW.template_id is distinct from OLD.template_id
    or NEW.flat_number is distinct from OLD.flat_number
    or NEW.tenant_name is distinct from OLD.tenant_name
    or NEW.monthly_rent is distinct from OLD.monthly_rent
    or NEW.maintenance_charge is distinct from OLD.maintenance_charge
    or NEW.car_parking_charge is distinct from OLD.car_parking_charge
    or NEW.washing_machine_charge is distinct from OLD.washing_machine_charge
    or NEW.other_monthly_charge is distinct from OLD.other_monthly_charge
    or NEW.other_charges_notes is distinct from OLD.other_charges_notes
    or NEW.deposit_amount is distinct from OLD.deposit_amount
    or NEW.deposit_paid is distinct from OLD.deposit_paid
    or NEW.admin_status is distinct from OLD.admin_status
    or NEW.approved_by is distinct from OLD.approved_by
    or NEW.approved_at is distinct from OLD.approved_at
  then
    raise exception 'Tenants can only accept an agreement, not change its terms.';
  end if;

  if NEW.tenant_status is distinct from 'accepted' then
    raise exception 'Tenants can only accept a pending agreement.';
  end if;

  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.tenancy_agreements') is null then
    return;
  end if;
  execute 'drop trigger if exists tenancy_agreements_protect_commercial on public.tenancy_agreements';
  execute $t$
    create trigger tenancy_agreements_protect_commercial
      before update on public.tenancy_agreements
      for each row
      execute procedure public.tenancy_agreements_protect_commercial()
  $t$;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Enable RLS + admin ALL + tenant SELECT on core tables (H9)
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenancies enable row level security;
alter table public.flats enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;

drop policy if exists tenants_admin_all on public.tenants;
create policy tenants_admin_all
  on public.tenants
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

drop policy if exists tenancies_admin_all on public.tenancies;
create policy tenancies_admin_all
  on public.tenancies
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

drop policy if exists flats_admin_all on public.flats;
create policy flats_admin_all
  on public.flats
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

drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all
  on public.payments
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

drop policy if exists receipts_admin_all on public.receipts;
create policy receipts_admin_all
  on public.receipts
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

drop policy if exists receipts_tenant_select on public.receipts;
create policy receipts_tenant_select
  on public.receipts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payments p
      join public.tenancies t on t.id = p.tenancy_id
      join public.tenants tn on tn.id = t.tenant_id
      where p.id = receipts.payment_id
        and tn.profile_id = auth.uid()
    )
  );

-- Tenant SELECT policies for tenants/tenancies/flats/payments already exist
-- in 20260902_tenant_portal_flats_rls.sql; recreate if this file is applied first.
drop policy if exists tenants_tenant_select on public.tenants;
create policy tenants_tenant_select
  on public.tenants
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists tenancies_tenant_select on public.tenancies;
create policy tenancies_tenant_select
  on public.tenancies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenants tn
      where tn.id = tenancies.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists flats_tenant_select on public.flats;
create policy flats_tenant_select
  on public.flats
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.flat_id = flats.id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists payments_tenant_select on public.payments;
create policy payments_tenant_select
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = payments.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );
