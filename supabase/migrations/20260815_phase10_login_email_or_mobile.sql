-- Resolve email for login when tenant enters mobile + password.
-- Run in Supabase SQL Editor after tenants.profile_id is linked.
-- Callable by anon (pre-login).

create or replace function public.resolve_login_email(identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  raw text := trim(coalesce(identifier, ''));
  digits text;
  found_email text;
begin
  if raw = '' then
    return null;
  end if;

  -- Email: return normalized
  if position('@' in raw) > 0 then
    return lower(raw);
  end if;

  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  if length(digits) = 12 and left(digits, 2) = '91' then
    digits := right(digits, 10);
  elsif length(digits) = 11 and left(digits, 1) = '0' then
    digits := right(digits, 10);
  end if;

  if length(digits) <> 10 then
    return null;
  end if;

  -- Prefer linked tenant row (tenants.phone → profile_id → auth.users.email)
  select u.email
    into found_email
  from public.tenants t
  join auth.users u on u.id = t.profile_id
  where t.profile_id is not null
    and right(regexp_replace(coalesce(t.phone, ''), '[^0-9]', '', 'g'), 10) = digits
  limit 1;

  if found_email is not null and found_email <> '' then
    return lower(found_email);
  end if;

  -- Fallback: Auth user phone field
  select u.email
    into found_email
  from auth.users u
  where right(regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), 10) = digits
  limit 1;

  if found_email is not null and found_email <> '' then
    return lower(found_email);
  end if;

  return null;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

comment on function public.resolve_login_email(text) is
  'Maps email or 10-digit mobile to Auth email for password sign-in. Mobile uses tenants.phone + profile_id.';
