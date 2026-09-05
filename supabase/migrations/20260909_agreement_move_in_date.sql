-- Snapshot move-in date on each tenancy agreement for the record.
-- Idempotent. Existing rows are backfilled from tenancies.start_date.

alter table public.tenancy_agreements
  add column if not exists move_in_date date;

comment on column public.tenancy_agreements.move_in_date is
  'Move-in date snapshotted from tenancies.start_date when the agreement draft was created.';

update public.tenancy_agreements a
set move_in_date = t.start_date::date
from public.tenancies t
where a.tenancy_id = t.id
  and a.move_in_date is null
  and t.start_date is not null;

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
    or NEW.move_in_date is distinct from OLD.move_in_date
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
