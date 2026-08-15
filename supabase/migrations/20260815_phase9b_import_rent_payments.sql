-- Phase 9B: import rent payments from rental-payment-tracking.csv
-- Rules: amount>0; paid date = sheet or due date (5th); skip D201/D302 (left);
-- skip amount-less rows; create receipts; deposits untouched.
-- Idempotent: skip if payment already exists for same tenancy + billing_month + amount_paid.

do $$
declare
  v_flat_id uuid;
  v_tenancy_id uuid;
  v_payment_id uuid;
  v_receipt_number text;
  v_suffix text;
  v_attempts int;
begin


  -- C102 2026-05 amount 20000
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C102' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C102';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C102';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 20000
        and coalesce(p.notes,'') like '%billing_month:2026-05%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C102', '2026-05';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-05-05', 20000, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-05
payment_date set to due date (5th) — paid date blank in source sheet
car_park:1000
agreed_rental_amount:21000'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202605-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C102';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C102', '2026-05', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- C302 2026-05 amount 14500
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C302' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C302';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C302';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 14500
        and coalesce(p.notes,'') like '%billing_month:2026-05%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C302', '2026-05';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-05-05', 14500, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-05
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:14500'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202605-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C302';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C302', '2026-05', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- D301 2026-05 amount 9000
  select f.id into v_flat_id from public.flats f where f.flat_number = 'D301' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'D301';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'D301';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 9000
        and coalesce(p.notes,'') like '%billing_month:2026-05%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'D301', '2026-05';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-05-05', 9000, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-05
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:9000'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202605-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'D301';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'D301', '2026-05', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- C102 2026-07 amount 21000
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C102' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C102';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C102';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 21000
        and coalesce(p.notes,'') like '%billing_month:2026-07%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C102', '2026-07';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-07-05', 21000, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-07
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:21000'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202607-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C102';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C102', '2026-07', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- C201 2026-07 amount 10000
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C201' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C201';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C201';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 10000
        and coalesce(p.notes,'') like '%billing_month:2026-07%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C201', '2026-07';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-07-05', 10000, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-07
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:10000'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202607-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C201';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C201', '2026-07', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- C202 2026-07 amount 14000
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C202' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C202';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C202';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 14000
        and coalesce(p.notes,'') like '%billing_month:2026-07%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C202', '2026-07';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-07-05', 14000, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-07
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:14000'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202607-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C202';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C202', '2026-07', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- C301 2026-07 amount 10000
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C301' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C301';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C301';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 10000
        and coalesce(p.notes,'') like '%billing_month:2026-07%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C301', '2026-07';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-07-05', 10000, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-07
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:10000'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202607-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C301';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C301', '2026-07', v_payment_id, v_receipt_number;
    end if;
  end if;


  -- C302 2026-07 amount 14500
  select f.id into v_flat_id from public.flats f where f.flat_number = 'C302' limit 1;
  if v_flat_id is null then
    raise notice 'SKIP %: flat not found', 'C302';
  else
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status,'')) in ('active','occupied','')
    order by t.created_at desc
    limit 1;

    if v_tenancy_id is null then
      raise notice 'SKIP %: no active tenancy', 'C302';
    elsif exists (
      select 1 from public.payments p
      where p.tenancy_id = v_tenancy_id
        and p.amount_paid = 14500
        and coalesce(p.notes,'') like '%billing_month:2026-07%'
    ) then
      raise notice 'SKIP % %: payment already exists', 'C302', '2026-07';
    else
      insert into public.payments (
        tenancy_id, payment_date, amount_paid, payment_mode, payment_type,
        status, notes
      ) values (
        v_tenancy_id, '2026-07-05', 14500, 'bank_transfer', 'rent',
        'paid', 'billing_month:2026-07
payment_date set to due date (5th) — paid date blank in source sheet
agreed_rental_amount:14500'
      ) returning id into v_payment_id;

      v_attempts := 0;
      loop
        v_attempts := v_attempts + 1;
        v_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_receipt_number := 'DR-202607-' || v_suffix;
        begin
          insert into public.receipts (payment_id, receipt_number)
          values (v_payment_id, v_receipt_number);
          exit;
        exception when unique_violation then
          if v_attempts >= 8 then
            raise exception 'Could not allocate receipt number for %', 'C302';
          end if;
        end;
      end loop;
      raise notice 'OK % % payment % receipt %', 'C302', '2026-07', v_payment_id, v_receipt_number;
    end if;
  end if;


end $$;

select 'payments' as kind, count(*)::text as n from payments
union all select 'receipts', count(*)::text from receipts;
