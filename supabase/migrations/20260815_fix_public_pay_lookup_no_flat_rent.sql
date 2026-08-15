-- Fix public pay lookup: rent/deposit live on tenancies, not flats.monthly_rent
-- Run in Supabase SQL Editor (safe to re-run).

create or replace function public.lookup_flat_for_public_pay(p_flat_number text)
returns table (
  flat_id uuid,
  flat_number text,
  status text,
  upi_id text,
  upi_qr_url text,
  monthly_rent numeric,
  maintenance_amount numeric,
  deposit numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := upper(trim(coalesce(p_flat_number, '')));
  v_id uuid;
  v_number text;
  v_status text;
  v_upi text := null;
  v_qr text := null;
  v_rent numeric := null;
  v_maint numeric := null;
  v_deposit numeric := null;
begin
  if raw = '' then
    return;
  end if;

  select f.id, f.flat_number, f.status
    into v_id, v_number, v_status
  from public.flats f
  where upper(trim(f.flat_number)) = raw
  limit 1;

  if v_id is null then
    return;
  end if;

  -- Optional per-flat UPI columns (added in phase10 flat_upi migration)
  begin
    execute
      'select nullif(trim(coalesce(upi_id, '''')), ''''),
              nullif(trim(coalesce(upi_qr_url, '''')), '''')
       from public.flats where id = $1'
      into v_upi, v_qr
      using v_id;
  exception
    when undefined_column then
      v_upi := null;
      v_qr := null;
  end;

  -- Optional maintenance on flats
  begin
    execute
      'select maintenance_amount from public.flats where id = $1'
      into v_maint
      using v_id;
  exception
    when undefined_column then
      v_maint := null;
  end;

  -- Rent + deposit from current/confirmed tenancy (never invent; no vacated)
  select
    t.monthly_rent,
    coalesce(t.deposit_amount, t.security_deposit)
    into v_rent, v_deposit
  from public.tenancies t
  where t.flat_id = v_id
    and lower(coalesce(t.status, '')) in ('active', 'occupied', 'confirmed', '')
  order by
    case lower(coalesce(t.status, ''))
      when 'active' then 0
      when 'occupied' then 0
      when 'confirmed' then 1
      else 2
    end,
    t.start_date desc nulls last
  limit 1;

  flat_id := v_id;
  flat_number := v_number;
  status := v_status;
  upi_id := v_upi;
  upi_qr_url := v_qr;
  monthly_rent := v_rent;
  maintenance_amount := v_maint;
  deposit := v_deposit;
  return next;
end;
$$;

revoke all on function public.lookup_flat_for_public_pay(text) from public;
grant execute on function public.lookup_flat_for_public_pay(text) to anon, authenticated;

comment on function public.lookup_flat_for_public_pay(text) is
  'Public pay: flat by number + UPI. Rent/deposit from active/confirmed tenancy (not flats.monthly_rent).';
