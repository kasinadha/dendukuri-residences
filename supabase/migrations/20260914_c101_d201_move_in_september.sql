-- C101 and D201 tenants moved in September 2026.
-- First dues are October 2026 (move-in month is not billed).
-- Older CSV/seed move-in dates (C101 06/01/2026, D201 August seed) made
-- September show as overdue and appear on Send reminder.
-- Idempotent. Safe to re-run in the SQL editor.

do $$
declare
  v_n int;
  v_has_move_in boolean;
begin
  update public.tenancies t
  set start_date = date '2026-09-01'
  from public.flats f
  where t.flat_id = f.id
    and f.flat_number in ('C101', 'D201')
    and lower(coalesce(t.status, '')) in (
      'active', 'occupied', 'notice', 'confirmed', ''
    )
    and (
      t.start_date is null
      or t.start_date::date < date '2026-09-01'
    );
  get diagnostics v_n = row_count;
  raise notice 'C101/D201: set start_date to 2026-09-01 on % tenancy row(s)', v_n;

  v_has_move_in := exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenancy_agreements'
      and column_name = 'move_in_date'
  );
  if v_has_move_in then
    update public.tenancy_agreements a
    set move_in_date = date '2026-09-01'
    from public.tenancies t
    join public.flats f on f.id = t.flat_id
    where a.tenancy_id = t.id
      and f.flat_number in ('C101', 'D201')
      and lower(coalesce(t.status, '')) in (
        'active', 'occupied', 'notice', 'confirmed', ''
      )
      and (
        a.move_in_date is null
        or a.move_in_date < date '2026-09-01'
      );
    get diagnostics v_n = row_count;
    raise notice 'C101/D201: set agreement move_in_date to 2026-09-01 on % row(s)', v_n;
  end if;

  -- Catch-up receipts from 20260913 for months before they lived there.
  update public.payments p
  set status = 'voided',
      notes = trim(both E'\n' from concat_ws(
        E'\n',
        nullif(trim(p.notes), ''),
        'Voided: tenant moved in September 2026; no dues before October.'
      ))
  from public.tenancies t
  join public.flats f on f.id = t.flat_id
  where p.tenancy_id = t.id
    and f.flat_number in ('C101', 'D201')
    and lower(coalesce(p.status, '')) not in ('voided', 'void')
    and coalesce(p.notes, '') ilike '%Paid through August 2026 (owner confirmed)%';
  get diagnostics v_n = row_count;
  raise notice 'C101/D201: voided % pre-move-in catch-up payment(s)', v_n;
end $$;
