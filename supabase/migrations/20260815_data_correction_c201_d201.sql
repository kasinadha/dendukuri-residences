-- DATA CORRECTION — C201 vacated / D201 reserved+confirmed
-- Paste entire file into Supabase SQL Editor and Run.
-- Idempotent: safe if C201 flat was already set vacant on a partial run.
-- Does NOT delete tenants, tenancies, payments, or receipts.
-- Does NOT invent move-in / vacate dates.
-- Does NOT insert rent payments for D201 confirmation.

-- ─────────────────────────────────────────────────────────────
-- 1) Expand status CHECKs BEFORE any updates (fixes 23514)
-- ─────────────────────────────────────────────────────────────

-- Discover-and-drop any CHECK on tenancies.status (name may vary)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tenancies'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.tenancies drop constraint %I', r.conname);
    raise notice 'Dropped tenancies constraint %', r.conname;
  end loop;
end $$;

alter table public.tenancies drop constraint if exists tenancies_status_check;

alter table public.tenancies
  add constraint tenancies_status_check
  check (
    status is null
    or lower(status) in (
      'active',
      'occupied',
      'confirmed',
      'vacated',
      'ended',
      'cancelled',
      'terminated',
      ''
    )
  );

-- Discover-and-drop any CHECK on flats.status (reserved may be blocked)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'flats'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.flats drop constraint %I', r.conname);
    raise notice 'Dropped flats constraint %', r.conname;
  end loop;
end $$;

alter table public.flats drop constraint if exists flats_status_check;

alter table public.flats
  add constraint flats_status_check
  check (
    status is null
    or lower(status) in (
      'vacant',
      'occupied',
      'reserved',
      'maintenance',
      'active',
      'rented',
      ''
    )
  );

-- Allow unknown move-in dates for confirmed reservations
alter table public.tenancies
  alter column start_date drop not null;

-- ─────────────────────────────────────────────────────────────
-- 2) Apply C201 / D201 business corrections
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_c201 uuid;
  v_d201 uuid;
  v_tenant_id uuid;
  v_tenancy_id uuid;
  v_n int;
begin
  select id into v_c201 from public.flats where flat_number = 'C201' limit 1;
  select id into v_d201 from public.flats where flat_number = 'D201' limit 1;

  -- ── C201: vacant flat, no active tenancy (history preserved) ──
  if v_c201 is null then
    raise notice 'C201: flat not found — skipped';
  else
    update public.flats
    set status = 'vacant'
    where id = v_c201
      and coalesce(lower(status), '') is distinct from 'vacant';
    get diagnostics v_n = row_count;
    raise notice 'C201 flats.status → vacant (rows updated: %)', v_n;

    update public.tenancies
    set status = 'vacated'
    where flat_id = v_c201
      and lower(coalesce(status, '')) in ('active', 'occupied', '');
    get diagnostics v_n = row_count;
    raise notice 'C201 tenancies.status → vacated for prior active rows (rows updated: %)', v_n;
    -- end_date intentionally unchanged (unknown — do not invent)
  end if;

  -- ── D201: reserved + confirmed; not occupied; no payment ──
  if v_d201 is null then
    raise notice 'D201: flat not found — skipped';
  else
    update public.flats
    set status = 'reserved'
    where id = v_d201
      and coalesce(lower(status), '') is distinct from 'reserved';
    get diagnostics v_n = row_count;
    raise notice 'D201 flats.status → reserved (rows updated: %)', v_n;

    select t.id, t.tenant_id
      into v_tenancy_id, v_tenant_id
    from public.tenancies t
    where t.flat_id = v_d201
      and lower(coalesce(t.status, '')) not in ('vacated', 'ended', 'cancelled', 'terminated')
    order by case lower(coalesce(t.status, ''))
      when 'confirmed' then 0
      when 'active' then 1
      when 'occupied' then 1
      else 2
    end
    limit 1;

    if v_tenancy_id is null then
      select id into v_tenant_id
      from public.tenants
      where full_name = 'D201 Tenant'
      limit 1;

      if v_tenant_id is null then
        insert into public.tenants (full_name)
        values ('D201 Tenant')
        returning id into v_tenant_id;
        raise notice 'D201: created tenants row D201 Tenant id=%', v_tenant_id;
      else
        raise notice 'D201: reused tenants row D201 Tenant id=%', v_tenant_id;
      end if;

      insert into public.tenancies (
        flat_id, tenant_id, status, monthly_rent,
        security_deposit, start_date, end_date, notes
      ) values (
        v_d201, v_tenant_id, 'confirmed', 10000,
        50000, null, null, 'source:Poster'
      )
      returning id into v_tenancy_id;
      raise notice 'D201: inserted tenancies id=% status=confirmed rent=10000 deposit=50000 start_date=NULL', v_tenancy_id;
    else
      update public.tenancies
      set status = 'confirmed',
          monthly_rent = 10000,
          security_deposit = 50000,
          start_date = null
      where id = v_tenancy_id
        and (
          coalesce(lower(status), '') is distinct from 'confirmed'
          or monthly_rent is distinct from 10000
          or security_deposit is distinct from 50000
          or start_date is not null
        );
      get diagnostics v_n = row_count;
      raise notice 'D201: updated tenancies id=% → confirmed / 10000 / 50000 / start_date=NULL (rows: %)', v_tenancy_id, v_n;
    end if;

    update public.tenancies
    set status = 'vacated'
    where flat_id = v_d201
      and id is distinct from v_tenancy_id
      and lower(coalesce(status, '')) in ('active', 'occupied', '');
    get diagnostics v_n = row_count;
    if v_n > 0 then
      raise notice 'D201: vacated % extra active tenancy row(s); confirmed row kept', v_n;
    end if;
  end if;

  raise notice 'No payments/receipts/tenants deleted. No rent payment created for D201 confirmation.';
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3) Verification snapshot
-- ─────────────────────────────────────────────────────────────
select f.flat_number,
       f.status as flat_status,
       t.id as tenancy_id,
       t.status as tenancy_status,
       t.monthly_rent,
       t.security_deposit,
       t.start_date,
       t.end_date,
       tn.full_name as tenant_name
from public.flats f
left join public.tenancies t
  on t.flat_id = f.id
left join public.tenants tn
  on tn.id = t.tenant_id
where f.flat_number in ('C201', 'D201')
order by f.flat_number, t.status;
