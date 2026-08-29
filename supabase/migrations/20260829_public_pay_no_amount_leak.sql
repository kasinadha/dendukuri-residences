-- Privacy: public pay lookup must NOT return rent, deposit, or maintenance.
-- Anyone can call this as anon; amounts are for logged-in tenants only.
-- Run in Supabase SQL Editor (safe to re-run).

drop function if exists public.lookup_flat_for_public_pay(text);

create function public.lookup_flat_for_public_pay(p_flat_number text)
returns table (
  flat_id uuid,
  flat_number text,
  status text,
  upi_id text,
  upi_qr_url text
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

  flat_id := v_id;
  flat_number := v_number;
  status := v_status;
  upi_id := v_upi;
  upi_qr_url := v_qr;
  return next;
end;
$$;

revoke all on function public.lookup_flat_for_public_pay(text) from public;
grant execute on function public.lookup_flat_for_public_pay(text) to anon, authenticated;

comment on function public.lookup_flat_for_public_pay(text) is
  'Public pay: flat by number + UPI only. Does not expose rent, deposit, or maintenance.';
