-- D201: remove duplicate deposit tenancy row and reclassify ₹50,000 deposit payment.
-- Idempotent — safe to run more than once.

do $$
declare
  v_d201_flat uuid;
  v_canonical_tenancy uuid;
  v_placeholder_tenancy uuid;
  v_payment uuid;
  v_n int;
begin
  select id into v_d201_flat from public.flats where flat_number = 'D201' limit 1;
  if v_d201_flat is null then
    raise notice 'D201 flat not found — skipped';
    return;
  end if;

  -- Prefer active/occupied tenancy (Fahad) over placeholder confirmed row.
  select t.id into v_canonical_tenancy
  from public.tenancies t
  join public.tenants tn on tn.id = t.tenant_id
  where t.flat_id = v_d201_flat
    and lower(coalesce(t.status, '')) in ('active', 'occupied', '')
  order by t.start_date desc nulls last
  limit 1;

  if v_canonical_tenancy is null then
    select t.id into v_canonical_tenancy
    from public.tenancies t
    where t.flat_id = v_d201_flat
      and lower(coalesce(t.status, '')) not in ('vacated', 'ended', 'cancelled', 'terminated')
    order by case lower(coalesce(t.status, ''))
      when 'confirmed' then 1
      else 2
    end,
    t.start_date desc nulls last
    limit 1;
  end if;

  select t.id into v_placeholder_tenancy
  from public.tenancies t
  join public.tenants tn on tn.id = t.tenant_id
  where t.flat_id = v_d201_flat
    and t.id is distinct from v_canonical_tenancy
    and tn.full_name = 'D201 Tenant'
    and lower(coalesce(t.status, '')) not in ('vacated', 'ended', 'cancelled', 'terminated')
  limit 1;

  if v_placeholder_tenancy is not null then
    update public.tenancies
    set status = 'cancelled',
        deposit_amount = 0,
        security_deposit = 0
    where id = v_placeholder_tenancy;
    get diagnostics v_n = row_count;
    raise notice 'D201: cancelled placeholder tenancy % (rows: %)', v_placeholder_tenancy, v_n;
  end if;

  if v_canonical_tenancy is null then
    raise notice 'D201: no canonical tenancy — skipped payment fix';
    return;
  end if;

  -- Reclassify ₹50,000 rent payment on D201 as deposit/advance.
  select p.id into v_payment
  from public.payments p
  join public.tenancies t on t.id = p.tenancy_id
  where t.flat_id = v_d201_flat
    and lower(coalesce(p.status, '')) <> 'voided'
    and lower(coalesce(p.payment_type, 'rent')) = 'rent'
    and p.amount_paid = 50000
  order by p.payment_date desc
  limit 1;

  if v_payment is not null then
    update public.payments
    set payment_type = 'advance',
        notes = coalesce(nullif(trim(notes), ''), '') ||
          case when coalesce(trim(notes), '') = '' then '' else E'\n' end ||
          'Reclassified from rent to deposit.'
    where id = v_payment;

    update public.tenancies
    set deposit_paid = greatest(coalesce(deposit_paid, 0), 50000),
        deposit_amount = greatest(coalesce(deposit_amount, 0), 50000),
        security_deposit = greatest(coalesce(security_deposit, 0), 50000),
        deposit_paid_date = coalesce(
          deposit_paid_date,
          (select payment_date from public.payments where id = v_payment)
        )
    where id = v_canonical_tenancy;

    raise notice 'D201: reclassified payment % and set deposit_paid on tenancy %', v_payment, v_canonical_tenancy;
  else
    raise notice 'D201: no ₹50,000 rent payment to reclassify (may already be advance)';
  end if;
end $$;
