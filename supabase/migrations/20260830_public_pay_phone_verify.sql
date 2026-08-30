-- Verify tenant mobile before revealing dues on public pay (privacy gate).

create or replace function public.verify_public_pay_tenant_phone(
  p_flat_number text,
  p_payer_phone text
)
returns table (
  tenancy_id uuid,
  flat_id uuid,
  tenant_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flat_id uuid;
  v_tenancy_id uuid;
  v_tenant_name text;
  v_phone_raw text := trim(coalesce(p_payer_phone, ''));
  v_phone_digits text;
  v_tenant_phone text;
begin
  select f.id into v_flat_id
  from public.flats f
  where upper(trim(f.flat_number)) = upper(trim(coalesce(p_flat_number, '')))
  limit 1;

  if v_flat_id is null then
    return;
  end if;

  v_phone_digits := regexp_replace(v_phone_raw, '[^0-9]', '', 'g');
  if length(v_phone_digits) = 12 and left(v_phone_digits, 2) = '91' then
    v_phone_digits := right(v_phone_digits, 10);
  elsif length(v_phone_digits) = 11 and left(v_phone_digits, 1) = '0' then
    v_phone_digits := right(v_phone_digits, 10);
  end if;

  if length(v_phone_digits) <> 10 then
    return;
  end if;

  select t.id, tn.full_name, tn.phone
    into v_tenancy_id, v_tenant_name, v_tenant_phone
  from public.tenancies t
  join public.tenants tn on tn.id = t.tenant_id
  where t.flat_id = v_flat_id
    and lower(coalesce(t.status, '')) in ('active', 'occupied', '')
  order by t.created_at desc nulls last
  limit 1;

  if v_tenancy_id is null then
    return;
  end if;

  v_tenant_phone := regexp_replace(coalesce(v_tenant_phone, ''), '[^0-9]', '', 'g');
  if length(v_tenant_phone) = 12 and left(v_tenant_phone, 2) = '91' then
    v_tenant_phone := right(v_tenant_phone, 10);
  elsif length(v_tenant_phone) = 11 and left(v_tenant_phone, 1) = '0' then
    v_tenant_phone := right(v_tenant_phone, 10);
  end if;

  if v_tenant_phone <> v_phone_digits then
    return;
  end if;

  tenancy_id := v_tenancy_id;
  flat_id := v_flat_id;
  tenant_name := v_tenant_name;
  return next;
end;
$$;

revoke all on function public.verify_public_pay_tenant_phone(text, text) from public;
grant execute on function public.verify_public_pay_tenant_phone(text, text) to anon, authenticated;

comment on function public.verify_public_pay_tenant_phone(text, text) is
  'Public pay privacy gate: returns tenancy when flat + registered tenant mobile match.';
