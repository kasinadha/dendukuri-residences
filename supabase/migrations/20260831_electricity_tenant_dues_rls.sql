-- Let tenants read billing runs linked to their flat's electricity readings
-- (needed for dues breakdown when joining readings → billing_runs).

drop policy if exists electricity_billing_runs_tenant_select
  on public.electricity_billing_runs;

create policy electricity_billing_runs_tenant_select
  on public.electricity_billing_runs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.electricity_readings er
      join public.tenancies t on t.flat_id = er.flat_id
      join public.tenants tn on tn.id = t.tenant_id
      where er.billing_run_id = electricity_billing_runs.id
        and tn.profile_id = auth.uid()
    )
  );

-- Backfill billing month on readings created before notes were stored.
update public.electricity_readings er
set notes = trim(
  coalesce(er.notes, '') ||
  case
    when coalesce(er.notes, '') like '%billing_month:%' then ''
    else case when er.notes is null or trim(er.notes) = '' then '' else E'\n' end ||
         'billing_month:' || br.billing_month
  end
)
from public.electricity_billing_runs br
where er.billing_run_id = br.id
  and (er.notes is null or er.notes not like '%billing_month:%');
