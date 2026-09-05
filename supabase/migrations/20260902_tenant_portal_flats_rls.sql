-- Tenant portal: read own tenant row, tenancies, flats, and payments (for receipt joins).
-- Safe to re-run; does not enable RLS on tables that are not already protected.

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
