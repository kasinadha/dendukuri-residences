-- C201 (Priyanshi / Priyakshi): May 2026 and June 2026 rent are fully paid.
-- The 5 Jun 2026 ₹10,000 receipt was saved as ₹10,000 of ₹20,000 (June plus
-- May arrears). That leftover kept June overdue and rolled ₹10,000 into later
-- months. Owner confirmed both months are paid.
-- Idempotent. Safe to re-run in the SQL editor.

do $$
declare
  v_flat_id uuid;
  v_tenancy_id uuid;
  v_rent numeric;
  v_payment_id uuid;
  v_receipt_number text;
  v_suffix text;
  v_attempts int;
  v_credited numeric;
  v_needed numeric;
  v_has_billing_month boolean;
  v_has_allocations boolean;
  v_notes text;
  r record;
begin
  select id into v_flat_id from public.flats where flat_number = 'C201' limit 1;
  if v_flat_id is null then
    raise notice 'C201: flat not found — skipped';
    return;
  end if;

  -- Prefer the tenancy that has the 5 Jun ₹10,000 payment, else active C201.
  select t.id into v_tenancy_id
  from public.payments p
  join public.tenancies t on t.id = p.tenancy_id
  where t.flat_id = v_flat_id
    and p.amount_paid = 10000
    and p.payment_date = '2026-06-05'
    and lower(coalesce(p.status, '')) not in ('voided', 'void')
  order by p.created_at desc
  limit 1;

  if v_tenancy_id is null then
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status, '')) in ('active', 'occupied', '')
    order by t.start_date desc nulls last, t.created_at desc
    limit 1;
  end if;

  if v_tenancy_id is null then
    raise notice 'C201: no tenancy to correct — skipped';
    return;
  end if;

  select coalesce(nullif(monthly_rent, 0), 10000)
    into v_rent
  from public.tenancies
  where id = v_tenancy_id;
  if v_rent is null or v_rent <= 0 then
    v_rent := 10000;
  end if;

  v_has_billing_month := exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'billing_month'
  );
  v_has_allocations := to_regclass('public.payment_allocations') is not null;

  -- 1) Fix the June receipt: amount due = amount paid, status paid.
  for r in
    select p.id, p.notes, p.amount_paid
    from public.payments p
    where p.tenancy_id = v_tenancy_id
      and lower(coalesce(p.status, '')) not in ('voided', 'void')
      and lower(coalesce(p.payment_type, 'rent')) in ('rent', 'maintenance', '')
      and p.amount_paid > 0
      and (
        coalesce(p.notes, '') like '%billing_month:2026-06%'
        or p.payment_date = date '2026-06-05'
        or (
          p.payment_date >= date '2026-06-01'
          and p.payment_date < date '2026-07-01'
          and coalesce(p.notes, '') not like '%billing_month:2026-05%'
          and coalesce(p.notes, '') not like '%billing_month:2026-07%'
        )
      )
  loop
    v_notes := coalesce(r.notes, '');
    v_notes := regexp_replace(v_notes, 'dues_breakdown:[^\n]*\n?', '', 'g');
    if v_notes !~ 'billing_month:2026-06' then
      v_notes := trim(both E'\n' from 'billing_month:2026-06' || E'\n' || v_notes);
    end if;
    if v_notes not like '%Corrected June 2026 amount_due%' then
      v_notes := trim(both E'\n' from v_notes || E'\nCorrected June 2026 amount_due to match amount paid (month fully paid).');
    end if;

    if v_has_billing_month then
      update public.payments
      set amount_due = r.amount_paid,
          status = 'paid',
          billing_month = '2026-06',
          notes = nullif(trim(v_notes), '')
      where id = r.id;
    else
      update public.payments
      set amount_due = r.amount_paid,
          status = 'paid',
          notes = nullif(trim(v_notes), '')
      where id = r.id;
    end if;

    if v_has_allocations then
      delete from public.payment_allocations where payment_id = r.id;
      insert into public.payment_allocations (payment_id, billing_month, amount)
      values (r.id, '2026-06', r.amount_paid);
    end if;

    raise notice 'C201: June payment % set to paid ₹% of ₹%', r.id, r.amount_paid, r.amount_paid;
  end loop;

  -- 2) Ensure May 2026 has ₹rent credited. Insert a May receipt if missing.
  v_credited := 0;
  for r in
    select p.id, p.amount_paid, p.notes, p.payment_date
    from public.payments p
    where p.tenancy_id = v_tenancy_id
      and lower(coalesce(p.status, '')) not in ('voided', 'void')
      and lower(coalesce(p.payment_type, 'rent')) in ('rent', 'maintenance', '')
      and p.amount_paid > 0
  loop
    if v_has_allocations and exists (
      select 1 from public.payment_allocations a where a.payment_id = r.id
    ) then
      select v_credited + coalesce(sum(a.amount), 0)
        into v_credited
      from public.payment_allocations a
      where a.payment_id = r.id
        and a.billing_month = '2026-05';
    elsif coalesce(r.notes, '') like '%billing_month:2026-05%'
      or (
        r.payment_date >= date '2026-05-01'
        and r.payment_date < date '2026-06-01'
        and coalesce(r.notes, '') not like '%billing_month:2026-0%'
      )
    then
      v_credited := v_credited + r.amount_paid;
    end if;
  end loop;

  v_needed := greatest(0, v_rent - v_credited);
  if v_needed > 0 then
    if v_has_billing_month then
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, amount_due,
        payment_mode, payment_type, status, billing_month, notes
      ) values (
        v_tenancy_id, '2026-05-05', v_needed, v_needed,
        'bank_transfer', 'rent', 'paid', '2026-05',
        'billing_month:2026-05
Recorded so May 2026 rent is fully paid (owner confirmed).'
      ) returning id into v_payment_id;
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, amount_due,
        payment_mode, payment_type, status, notes
      ) values (
        v_tenancy_id, '2026-05-05', v_needed, v_needed,
        'bank_transfer', 'rent', 'paid',
        'billing_month:2026-05
Recorded so May 2026 rent is fully paid (owner confirmed).'
      ) returning id into v_payment_id;
    end if;

    if v_has_allocations then
      insert into public.payment_allocations (payment_id, billing_month, amount)
      values (v_payment_id, '2026-05', v_needed);
    end if;

    v_attempts := 0;
    loop
      v_attempts := v_attempts + 1;
      begin
        if to_regprocedure('public.allocate_receipt_number()') is not null then
          v_receipt_number := public.allocate_receipt_number();
        else
          v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
          v_receipt_number := 'DR-202605-' || v_suffix;
        end if;
        insert into public.receipts (payment_id, receipt_number)
        values (v_payment_id, v_receipt_number);
        exit;
      exception when unique_violation then
        if v_attempts >= 8 then
          raise exception 'C201: could not allocate May receipt number';
        end if;
      end;
    end loop;

    raise notice 'C201: inserted May 2026 payment % ₹% receipt %', v_payment_id, v_needed, v_receipt_number;
  else
    raise notice 'C201: May 2026 already has ₹% credited — no insert', v_credited;
  end if;
end $$;
