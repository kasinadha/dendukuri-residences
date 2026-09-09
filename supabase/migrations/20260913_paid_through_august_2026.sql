-- All occupied tenancies: dues are fully paid through August 2026.
-- Owner confirmed everyone (not only C201) is paid through last month.
-- As of 9 Sep 2026, last month is August — September 2026+ stays the live
-- tracking month (rent, charges, electricity, fines).
--
-- Matches the app ledger:
--   * Move-in month and earlier: no dues (first billed month is the next one)
--   * Vacate month included; cancelled/rejected excluded
--   * Month due = rent + tenancy charges (else flat maintenance) + electricity
--     (latest reading for that billing month, whole rupees) + fines
--   * Credited cash = payment_allocations if present, else billing_month /
--     notes / payment date (rent + maintenance only; deposits ignored)
--
-- 1) Live rent/maintenance receipts attributed only to months <= 2026-08:
--    amount_due = amount_paid, status paid, strip stale dues_breakdown snapshots.
-- 2) Insert a catch-up receipt + allocation for any remaining shortfall.
--
-- Idempotent. Safe if 20260912 (C201 May/June) already ran.
-- Does not credit or rewrite September 2026+ receipts.
-- Skip D001 (maintenance staff / dummy).
--
-- Requires 20260906 (billing_month + payment_allocations). Run in SQL Editor.

do $$
declare
  v_cutoff text := '2026-08';
  v_has_billing_month boolean;
  v_has_allocations boolean;
  v_has_charges boolean;
  v_has_fines boolean;
  v_has_elec boolean;
  v_has_runs boolean;
  v_rewritten int := 0;
  v_inserted int := 0;
  v_payment_id uuid;
  v_receipt_number text;
  v_suffix text;
  v_attempts int;
  due_row record;
begin
  v_has_billing_month := exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'billing_month'
  );
  if not v_has_billing_month then
    raise exception 'Run supabase/migrations/20260906_phase1_integrity_ledger.sql first (payments.billing_month missing)';
  end if;

  v_has_allocations := to_regclass('public.payment_allocations') is not null;
  v_has_charges := exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenancies'
      and column_name = 'maintenance_charge'
  );
  v_has_fines := to_regclass('public.tenant_fines') is not null;
  v_has_elec := to_regclass('public.electricity_readings') is not null;
  v_has_runs := to_regclass('public.electricity_billing_runs') is not null;

  if not v_has_charges then
    raise exception 'Run supabase/migrations/20260829_tenancy_monthly_charges.sql first (tenancies.maintenance_charge missing)';
  end if;

  create temporary table tmp_payment_credit (
    payment_id uuid not null,
    tenancy_id uuid not null,
    billing_month text not null,
    amount numeric(12,2) not null default 0,
    is_waived boolean not null default false
  ) on commit drop;

  -- Attributed amounts: allocations win; otherwise billing_month / notes / date.
  if v_has_allocations then
    insert into tmp_payment_credit (payment_id, tenancy_id, billing_month, amount, is_waived)
    select p.id, p.tenancy_id, a.billing_month, a.amount, false
    from public.payments p
    join public.payment_allocations a on a.payment_id = p.id
    where p.tenancy_id is not null
      and lower(coalesce(p.status, '')) not in ('voided', 'void')
      and lower(p.payment_type) in ('rent', 'maintenance')
      and a.amount > 0
      and exists (select 1 from public.payment_allocations x where x.payment_id = p.id);

    insert into tmp_payment_credit (payment_id, tenancy_id, billing_month, amount, is_waived)
    select p.id,
           p.tenancy_id,
           coalesce(
             nullif(p.billing_month, ''),
             substring(p.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
             to_char(p.payment_date, 'YYYY-MM')
           ),
           coalesce(p.amount_paid, 0),
           false
    from public.payments p
    where p.tenancy_id is not null
      and lower(coalesce(p.status, '')) not in ('voided', 'void')
      and lower(p.payment_type) in ('rent', 'maintenance')
      and coalesce(p.amount_paid, 0) > 0
      and not exists (select 1 from public.payment_allocations x where x.payment_id = p.id)
      and coalesce(
            nullif(p.billing_month, ''),
            substring(p.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
            to_char(p.payment_date, 'YYYY-MM')
          ) ~ '^[0-9]{4}-[0-9]{2}$';
  else
    insert into tmp_payment_credit (payment_id, tenancy_id, billing_month, amount, is_waived)
    select p.id,
           p.tenancy_id,
           coalesce(
             nullif(p.billing_month, ''),
             substring(p.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
             to_char(p.payment_date, 'YYYY-MM')
           ),
           coalesce(p.amount_paid, 0),
           false
    from public.payments p
    where p.tenancy_id is not null
      and lower(coalesce(p.status, '')) not in ('voided', 'void')
      and lower(p.payment_type) in ('rent', 'maintenance')
      and coalesce(p.amount_paid, 0) > 0
      and coalesce(
            nullif(p.billing_month, ''),
            substring(p.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
            to_char(p.payment_date, 'YYYY-MM')
          ) ~ '^[0-9]{4}-[0-9]{2}$';
  end if;

  -- Waived rows cover their display month by amount_due (same as the app ledger).
  insert into tmp_payment_credit (payment_id, tenancy_id, billing_month, amount, is_waived)
  select p.id,
         p.tenancy_id,
         coalesce(
           nullif(p.billing_month, ''),
           substring(p.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
           to_char(p.payment_date, 'YYYY-MM')
         ),
         coalesce(p.amount_due, 0),
         true
  from public.payments p
  where p.tenancy_id is not null
    and lower(coalesce(p.status, '')) = 'waived'
    and lower(p.payment_type) in ('rent', 'maintenance')
    and coalesce(p.amount_due, 0) > 0
    and coalesce(
          nullif(p.billing_month, ''),
          substring(p.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
          to_char(p.payment_date, 'YYYY-MM')
        ) ~ '^[0-9]{4}-[0-9]{2}$';

  -- 1) Receipts that only cover months through August: mark fully paid.
  update public.payments p
  set amount_due = p.amount_paid,
      status = 'paid',
      notes = nullif(
        trim(both E'\n' from regexp_replace(
          regexp_replace(coalesce(p.notes, ''), 'dues_breakdown:[^\n]*\n?', '', 'g'),
          E'\n{3,}',
          E'\n\n',
          'g'
        )),
        ''
      )
  where p.tenancy_id is not null
    and lower(coalesce(p.status, '')) not in ('voided', 'void', 'waived')
    and lower(p.payment_type) in ('rent', 'maintenance')
    and coalesce(p.amount_paid, 0) > 0
    and exists (
      select 1 from tmp_payment_credit c
      where c.payment_id = p.id
        and c.billing_month <= v_cutoff
        and not c.is_waived
    )
    and not exists (
      select 1 from tmp_payment_credit c
      where c.payment_id = p.id
        and c.billing_month > v_cutoff
        and not c.is_waived
    );

  get diagnostics v_rewritten = row_count;
  raise notice 'Paid through Aug 2026: rewrote % receipt(s) (amount_due = amount_paid)', v_rewritten;

  create temporary table tmp_elec (
    flat_id uuid not null,
    billing_month text not null,
    bill_amount numeric(12,2) not null
  ) on commit drop;

  create temporary table tmp_fines (
    tenancy_id uuid not null,
    billing_month text not null,
    amount numeric(12,2) not null
  ) on commit drop;

  if v_has_elec and v_has_runs then
    insert into tmp_elec (flat_id, billing_month, bill_amount)
    select distinct on (labeled.flat_id, labeled.billing_month)
      labeled.flat_id,
      labeled.billing_month,
      round(coalesce(labeled.bill_amount, 0), 0)::numeric
    from (
      select er.flat_id,
             er.bill_amount,
             er.reading_date,
             er.created_at,
             coalesce(
               ebr.billing_month,
               substring(er.notes from 'billing_month:([0-9]{4}-[0-9]{2})')
             ) as billing_month
      from public.electricity_readings er
      left join public.electricity_billing_runs ebr on ebr.id = er.billing_run_id
    ) labeled
    where labeled.billing_month is not null
      and labeled.billing_month <= v_cutoff
      and coalesce(labeled.bill_amount, 0) > 0
    order by labeled.flat_id, labeled.billing_month,
             labeled.reading_date desc nulls last,
             labeled.created_at desc nulls last;
  elsif v_has_elec then
    insert into tmp_elec (flat_id, billing_month, bill_amount)
    select distinct on (er.flat_id, substring(er.notes from 'billing_month:([0-9]{4}-[0-9]{2})'))
      er.flat_id,
      substring(er.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
      round(coalesce(er.bill_amount, 0), 0)::numeric
    from public.electricity_readings er
    where substring(er.notes from 'billing_month:([0-9]{4}-[0-9]{2})') is not null
      and substring(er.notes from 'billing_month:([0-9]{4}-[0-9]{2})') <= v_cutoff
      and coalesce(er.bill_amount, 0) > 0
    order by er.flat_id,
             substring(er.notes from 'billing_month:([0-9]{4}-[0-9]{2})'),
             er.reading_date desc nulls last,
             er.created_at desc nulls last;
  end if;

  if v_has_fines then
    insert into tmp_fines (tenancy_id, billing_month, amount)
    select tf.tenancy_id, tf.billing_month, sum(tf.amount)::numeric
    from public.tenant_fines tf
    where tf.billing_month <= v_cutoff
    group by tf.tenancy_id, tf.billing_month;
  end if;

  create temporary table tmp_due (
    tenancy_id uuid not null,
    flat_number text,
    tenant_name text,
    billing_month text not null,
    month_due numeric(12,2) not null,
    credited numeric(12,2) not null default 0,
    needed numeric(12,2) not null default 0
  ) on commit drop;

  -- Billed months through August for every tenancy that owes dues that month.
  insert into tmp_due (tenancy_id, flat_number, tenant_name, billing_month, month_due, credited, needed)
  with months as (
    select to_char(d, 'YYYY-MM') as billing_month,
           d::date as month_start,
           (d + interval '1 month - 1 day')::date as month_end
    from generate_series(date '2020-01-01', date '2026-08-01', interval '1 month') d
  ),
  billed as (
    select
      t.id as tenancy_id,
      f.flat_number,
      tn.full_name as tenant_name,
      m.billing_month,
      (
        coalesce(t.monthly_rent, 0)
        + case
            when t.maintenance_charge is not null then t.maintenance_charge
            else coalesce(f.maintenance_amount, 0)
          end
        + coalesce(t.car_parking_charge, 0)
        + coalesce(t.washing_machine_charge, 0)
        + coalesce(t.other_monthly_charge, 0)
        + coalesce(e.bill_amount, 0)
        + coalesce(fn.amount, 0)
      )::numeric(12,2) as month_due
    from public.tenancies t
    join public.flats f on f.id = t.flat_id
    left join public.tenants tn on tn.id = t.tenant_id
    cross join months m
    left join tmp_elec e
      on e.flat_id = t.flat_id and e.billing_month = m.billing_month
    left join tmp_fines fn
      on fn.tenancy_id = t.id and fn.billing_month = m.billing_month
    where f.flat_number is distinct from 'D001'
      and t.start_date is not null
      and lower(coalesce(t.status, '')) not in ('cancelled', 'rejected')
      and m.billing_month > to_char(date_trunc('month', t.start_date::timestamp), 'YYYY-MM')
      and (
        case
          when lower(coalesce(t.status, '')) in ('vacated', 'ended', 'terminated', 'transferred') then
            t.end_date is not null
            and coalesce(t.start_date, t.end_date) <= m.month_end
            and t.end_date >= m.month_start
          when lower(coalesce(t.status, '')) = 'confirmed' then
            t.start_date >= m.month_start and t.start_date <= m.month_end
          else
            t.start_date <= m.month_end
            and coalesce(t.end_date, date '9999-12-31') >= m.month_start
        end
      )
  )
  select
    b.tenancy_id,
    b.flat_number,
    b.tenant_name,
    b.billing_month,
    b.month_due,
    coalesce(c.credited, 0)::numeric(12,2) as credited,
    greatest(0, b.month_due - coalesce(c.credited, 0))::numeric(12,2) as needed
  from billed b
  left join (
    select tenancy_id, billing_month, sum(amount)::numeric as credited
    from tmp_payment_credit
    group by tenancy_id, billing_month
  ) c on c.tenancy_id = b.tenancy_id and c.billing_month = b.billing_month
  where b.month_due > 0
    and greatest(0, b.month_due - coalesce(c.credited, 0)) > 0;

  for due_row in
    select tenancy_id, flat_number, tenant_name, billing_month, month_due, credited, needed
    from tmp_due
    order by flat_number, billing_month
  loop
    if v_has_billing_month then
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, amount_due,
        payment_mode, payment_type, status, billing_month, notes
      ) values (
        due_row.tenancy_id,
        (due_row.billing_month || '-05')::date,
        due_row.needed,
        due_row.needed,
        'bank_transfer',
        'rent',
        'paid',
        due_row.billing_month,
        'billing_month:' || due_row.billing_month || E'\nPaid through August 2026 (owner confirmed).'
      ) returning id into v_payment_id;
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, amount_due,
        payment_mode, payment_type, status, notes
      ) values (
        due_row.tenancy_id,
        (due_row.billing_month || '-05')::date,
        due_row.needed,
        due_row.needed,
        'bank_transfer',
        'rent',
        'paid',
        'billing_month:' || due_row.billing_month || E'\nPaid through August 2026 (owner confirmed).'
      ) returning id into v_payment_id;
    end if;

    if v_has_allocations then
      insert into public.payment_allocations (payment_id, billing_month, amount)
      values (v_payment_id, due_row.billing_month, due_row.needed);
    end if;

    v_attempts := 0;
    loop
      v_attempts := v_attempts + 1;
      begin
        if to_regprocedure('public.allocate_receipt_number()') is not null then
          v_receipt_number := public.allocate_receipt_number();
        else
          v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
          v_receipt_number := 'DR-' || replace(due_row.billing_month, '-', '') || '-' || v_suffix;
        end if;
        insert into public.receipts (payment_id, receipt_number)
        values (v_payment_id, v_receipt_number);
        exit;
      exception when unique_violation then
        if v_attempts >= 8 then
          raise exception 'Could not allocate receipt for % %', due_row.flat_number, due_row.billing_month;
        end if;
      end;
    end loop;

    v_inserted := v_inserted + 1;
    raise notice 'Catch-up % % (%) ₹% (due ₹%, already credited ₹%) receipt %',
      due_row.flat_number, due_row.billing_month, coalesce(due_row.tenant_name, '—'),
      due_row.needed, due_row.month_due, due_row.credited, v_receipt_number;
  end loop;

  raise notice 'Paid through Aug 2026: inserted % catch-up payment(s). September 2026+ unchanged.', v_inserted;
end $$;
