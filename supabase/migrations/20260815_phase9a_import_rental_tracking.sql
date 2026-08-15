-- Phase 9A: schema + import from data/rental-tracking.csv
-- Idempotent. Advances = deposits (no rent payments).
-- Run once in Supabase SQL Editor.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.flats
  add column if not exists property_id uuid references public.properties (id),
  add column if not exists floor integer,
  add column if not exists maintenance_amount numeric;

alter table public.tenancies
  add column if not exists deposit_amount numeric,
  add column if not exists deposit_paid numeric,
  add column if not exists deposit_paid_date date,
  add column if not exists notes text;

-- D001 and similar: rent/deposit may be unspecified in source (do not invent ₹0).
alter table public.tenancies
  alter column monthly_rent drop not null;

alter table public.tenancies
  alter column security_deposit drop not null;

alter table public.properties enable row level security;

drop policy if exists properties_admin_all on public.properties;
create policy properties_admin_all
  on public.properties
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_active, true)
    )
  );

insert into public.properties (name)
values ('Dendukuri''s Residences')
on conflict (name) do nothing;


do $$
declare
  v_prop_id uuid;
  v_flat_id uuid;
  v_tenant_id uuid;
begin
  select id into v_prop_id from public.properties where name = 'Dendukuri''s Residences' limit 1;


  -- Flat C001
  if not exists (select 1 from public.flats where flat_number = 'C001') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C001', '1BHK', 0, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, 'car_park:1000');
  end if;


  select id into v_flat_id from public.flats where flat_number = 'C001' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'jerryn  joseph'
      and coalesce(phone,'') = coalesce('7204405414','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('jerryn  joseph', '7204405414')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 12000,
      24000, 24000, 24000, '2026-06-04',
      '2026-07-01', 'Paid to: canara bank joint A/C'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat C101
  if not exists (select 1 from public.flats where flat_number = 'C101') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C101', '1BHK', 1, 'vacant', v_prop_id, 'Dendukuri''s Residences', NULL, 'Moved in Date (raw, vacant): 06/01/2026');
  end if;


  -- Flat C102
  if not exists (select 1 from public.flats where flat_number = 'C102') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C102', '2BHK', 1, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, 'car_park:1000');
  end if;


  select id into v_flat_id from public.flats where flat_number = 'C102' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Abilash'
      and coalesce(phone,'') = coalesce('9492840830','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Abilash', '9492840830')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 20000,
      40000, 40000, 40000, '2026-03-16',
      '2026-04-01', 'Paid to: 5000 to akka A/C
35000 to joint A/C
Advance part-payments: 23/02/2026 + 16/03/2026 (raw: 23/02/2026 
16/03/2026)'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat C201
  if not exists (select 1 from public.flats where flat_number = 'C201') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C201', '1BHK', 2, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, 'car_park:0');
  end if;


  select id into v_flat_id from public.flats where flat_number = 'C201' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Priyakshi'
      and coalesce(phone,'') = coalesce('7702364029','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Priyakshi', '7702364029')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 10000,
      20000, 20000, 20000, '2026-03-04',
      '2026-04-03', 'Paid to: canara bank joint A/C'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat C202
  if not exists (select 1 from public.flats where flat_number = 'C202') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C202', '2BHK', 2, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, 'car_park:0');
  end if;


  select id into v_flat_id from public.flats where flat_number = 'C202' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Jagadesh'
      and coalesce(phone,'') = coalesce('9848776838
9164740695','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Jagadesh', '9848776838
9164740695')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 14000,
      50000, 50000, 50000, '2026-04-12',
      '2026-04-12', 'Paid to: canara bank joint A/C
Advance part-payments: 03/15/2026 + 04/12/2026 (raw: 03/15/2026 04/12/2026)
Review: multiple phones
start_date set from final deposit date (Moved in Date blank in source).'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat C301
  if not exists (select 1 from public.flats where flat_number = 'C301') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C301', '1BHK', 3, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, 'car_park:0');
  end if;


  select id into v_flat_id from public.flats where flat_number = 'C301' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Mahesh'
      and coalesce(phone,'') = coalesce('9550564722','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Mahesh', '9550564722')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 10000,
      35000, 35000, 35000, '2026-06-17',
      '2026-06-17', 'Paid to: canara bank joint A/C'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat C302
  if not exists (select 1 from public.flats where flat_number = 'C302') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('C302', '2BHK', 3, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, 'car_park:0');
  end if;


  select id into v_flat_id from public.flats where flat_number = 'C302' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Mithun Gowda'
      and coalesce(phone,'') = coalesce('9019934624','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Mithun Gowda', '9019934624')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 14500,
      30000, 30000, 30000, '2026-03-11',
      '2026-04-01', 'Paid to: canara bank joint A/C'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat D001
  if not exists (select 1 from public.flats where flat_number = 'D001') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D001', '1BHK', 0, 'occupied', v_prop_id, 'Dendukuri''s Residences', NULL, NULL);
  end if;


  select id into v_flat_id from public.flats where flat_number = 'D001' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Prabhu [ Maintainence]'
      and coalesce(phone,'') = coalesce('6380464852','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Prabhu [ Maintainence]', '6380464852')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', NULL,
      NULL, NULL, NULL, NULL,
      '2026-03-01', 'Rent not specified in source sheet.'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat D101
  if not exists (select 1 from public.flats where flat_number = 'D101') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D101', '1BHK', 1, 'vacant', v_prop_id, 'Dendukuri''s Residences', NULL, NULL);
  end if;


  -- Flat D102
  if not exists (select 1 from public.flats where flat_number = 'D102') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D102', '2BHK', 1, 'vacant', v_prop_id, 'Dendukuri''s Residences', NULL, NULL);
  end if;


  -- Flat D201
  if not exists (select 1 from public.flats where flat_number = 'D201') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D201', '1BHK', 2, 'vacant', v_prop_id, 'Dendukuri''s Residences', 0, NULL);
  end if;


  -- Flat D202
  if not exists (select 1 from public.flats where flat_number = 'D202') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D202', '2BHK', 2, 'vacant', v_prop_id, 'Dendukuri''s Residences', NULL, NULL);
  end if;


  -- Flat D301
  if not exists (select 1 from public.flats where flat_number = 'D301') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D301', '1BHK', 3, 'occupied', v_prop_id, 'Dendukuri''s Residences', 0, NULL);
  end if;


  select id into v_flat_id from public.flats where flat_number = 'D301' limit 1;

  select id into v_tenant_id from public.tenants
    where full_name = 'Sreesha D'
      and coalesce(phone,'') = coalesce('7338388485','')
    limit 1;

  if v_tenant_id is null then
    insert into public.tenants (full_name, phone)
    values ('Sreesha D', '7338388485')
    returning id into v_tenant_id;
  end if;

  if not exists (
    select 1 from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
  ) then
    insert into public.tenancies (
      flat_id, tenant_id, status, monthly_rent,
      security_deposit, deposit_amount, deposit_paid, deposit_paid_date,
      start_date, notes
    ) values (
      v_flat_id, v_tenant_id, 'active', 9000,
      18000, 18000, 18000, '2026-03-30',
      '2026-04-01', 'Paid to: canara bank joint A/C [ 10000 + 8000]'
    );
    update public.flats set status = 'occupied', property_id = v_prop_id where id = v_flat_id;
  end if;


  -- Flat D302
  if not exists (select 1 from public.flats where flat_number = 'D302') then
    insert into public.flats (flat_number, flat_type, floor, status, property_id, building, maintenance_amount, notes)
    values ('D302', '2BHK', 3, 'vacant', v_prop_id, 'Dendukuri''s Residences', 0, NULL);
  end if;


end $$;

select 'properties' as kind, count(*)::text as n from properties where name = 'Dendukuri''s Residences'
union all select 'flats', count(*)::text from flats
union all select 'tenants', count(*)::text from tenants
union all select 'tenancies', count(*)::text from tenancies
union all select 'payments', count(*)::text from payments;
