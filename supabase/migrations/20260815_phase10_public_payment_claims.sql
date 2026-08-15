-- Phase 10c: public (no-login) payment claims for rent / advance / maintenance
-- PREREQUISITE: 20260815_phase10_payment_submissions.sql (+ optional payment_proofs).
-- Run in Supabase SQL Editor. Does NOT use service_role from the Next.js app.
--
-- Enables:
--   - pending payment_submissions tied to flat_id (tenancy optional)
--   - purpose: rent | advance | maintenance
--   - payer_name / payer_phone for contact
--   - SECURITY DEFINER RPCs callable by anon for lookup + submit
--   - optional proof upload under payment-proofs/public-claims/...

do $$
begin
  if to_regclass('public.payment_submissions') is null then
    raise exception
      'public.payment_submissions does not exist. Run 20260815_phase10_payment_submissions.sql first.';
  end if;
end $$;

-- Ensure flat UPI columns exist (idempotent; also in phase10_flat_upi_qr.sql)
alter table public.flats
  add column if not exists upi_id text,
  add column if not exists upi_qr_url text;

-- ---------------------------------------------------------------------------
-- Schema: support flat-tied public claims
-- ---------------------------------------------------------------------------

alter table public.payment_submissions
  alter column tenancy_id drop not null;

alter table public.payment_submissions
  add column if not exists flat_id uuid references public.flats (id);

alter table public.payment_submissions
  add column if not exists purpose text;

alter table public.payment_submissions
  add column if not exists payer_name text;

alter table public.payment_submissions
  add column if not exists payer_phone text;

-- Backfill purpose for existing tenant rent submissions
update public.payment_submissions
set purpose = 'rent'
where purpose is null;

alter table public.payment_submissions
  alter column purpose set default 'rent';

alter table public.payment_submissions
  alter column purpose set not null;

alter table public.payment_submissions
  drop constraint if exists payment_submissions_purpose_check;

alter table public.payment_submissions
  add constraint payment_submissions_purpose_check
  check (purpose in ('rent', 'advance', 'maintenance'));

-- Billing month required for rent; optional for advance / maintenance
alter table public.payment_submissions
  alter column billing_month drop not null;

alter table public.payment_submissions
  drop constraint if exists payment_submissions_billing_month_chk;

alter table public.payment_submissions
  add constraint payment_submissions_billing_month_chk
  check (
    (purpose = 'rent' and billing_month is not null and billing_month ~ '^\d{4}-\d{2}$')
    or (purpose in ('advance', 'maintenance')
        and (billing_month is null or billing_month ~ '^\d{4}-\d{2}$'))
  );

alter table public.payment_submissions
  drop constraint if exists payment_submissions_tenancy_or_flat_chk;

alter table public.payment_submissions
  add constraint payment_submissions_tenancy_or_flat_chk
  check (tenancy_id is not null or flat_id is not null);

create index if not exists payment_submissions_flat_idx
  on public.payment_submissions (flat_id, created_at desc);

create index if not exists payment_submissions_purpose_idx
  on public.payment_submissions (purpose, status, created_at desc);

comment on column public.payment_submissions.flat_id is
  'Flat this claim is for. Required for public (no-login) claims; also set when known.';
comment on column public.payment_submissions.purpose is
  'rent | advance | maintenance';
comment on column public.payment_submissions.payer_name is
  'Contact name for public claims (no auth session).';
comment on column public.payment_submissions.payer_phone is
  'Contact phone for public claims (no auth session).';

-- Backfill flat_id from tenancy where missing
update public.payment_submissions ps
set flat_id = t.flat_id
from public.tenancies t
where ps.tenancy_id = t.id
  and ps.flat_id is null
  and t.flat_id is not null;

-- ---------------------------------------------------------------------------
-- Public RPCs (anon-safe, SECURITY DEFINER)
-- ---------------------------------------------------------------------------

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

  begin
    execute
      'select maintenance_amount from public.flats where id = $1'
      into v_maint
      using v_id;
  exception
    when undefined_column then
      v_maint := null;
  end;

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

create or replace function public.submit_public_payment_claim(
  p_flat_number text,
  p_purpose text,
  p_amount numeric,
  p_payment_date date,
  p_utr text,
  p_payer_name text,
  p_payer_phone text,
  p_billing_month text default null,
  p_notes text default null,
  p_upi_id text default null,
  p_proof_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flat_id uuid;
  v_tenancy_id uuid;
  v_purpose text := lower(trim(coalesce(p_purpose, '')));
  v_utr text := trim(coalesce(p_utr, ''));
  v_name text := trim(coalesce(p_payer_name, ''));
  v_phone_raw text := trim(coalesce(p_payer_phone, ''));
  v_phone_digits text;
  v_month text := nullif(trim(coalesce(p_billing_month, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_upi text := nullif(trim(coalesce(p_upi_id, '')), '');
  v_proof text := nullif(trim(coalesce(p_proof_path, '')), '');
  v_id uuid;
  v_pending int;
begin
  if v_purpose not in ('rent', 'advance', 'maintenance') then
    raise exception 'Invalid purpose. Use rent, advance, or maintenance.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid amount.';
  end if;

  if p_payment_date is null then
    raise exception 'Payment date is required.';
  end if;

  if v_utr = '' then
    raise exception 'UTR / transaction reference is required.';
  end if;

  if v_name = '' then
    raise exception 'Payer name is required.';
  end if;

  v_phone_digits := regexp_replace(v_phone_raw, '[^0-9]', '', 'g');
  if length(v_phone_digits) = 12 and left(v_phone_digits, 2) = '91' then
    v_phone_digits := right(v_phone_digits, 10);
  elsif length(v_phone_digits) = 11 and left(v_phone_digits, 1) = '0' then
    v_phone_digits := right(v_phone_digits, 10);
  end if;

  if length(v_phone_digits) <> 10 then
    raise exception 'Enter a valid 10-digit mobile number.';
  end if;

  if v_purpose = 'rent' then
    if v_month is null or v_month !~ '^\d{4}-\d{2}$' then
      raise exception 'Billing month is required for rent payments.';
    end if;
  elsif v_month is not null and v_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Billing month is invalid.';
  end if;

  if v_proof is not null and v_proof not like 'public-claims/%' then
    raise exception 'Invalid proof path.';
  end if;

  select f.id into v_flat_id
  from public.flats f
  where upper(trim(f.flat_number)) = upper(trim(coalesce(p_flat_number, '')))
  limit 1;

  if v_flat_id is null then
    raise exception 'Flat number not found. Check the number and try again.';
  end if;

  -- Prefer linking an active/occupied tenancy when present (admin approve path).
  select t.id into v_tenancy_id
  from public.tenancies t
  where t.flat_id = v_flat_id
    and lower(coalesce(t.status, '')) in ('active', 'occupied', '')
  order by t.created_at desc nulls last
  limit 1;

  -- Also allow reserved tenancy for advance claims
  if v_tenancy_id is null then
    select t.id into v_tenancy_id
    from public.tenancies t
    where t.flat_id = v_flat_id
      and lower(coalesce(t.status, '')) = 'reserved'
    order by t.created_at desc nulls last
    limit 1;
  end if;

  -- Light duplicate guard: same flat + purpose + utr still pending
  select count(*)::int into v_pending
  from public.payment_submissions ps
  where ps.flat_id = v_flat_id
    and ps.purpose = v_purpose
    and ps.utr = v_utr
    and ps.status = 'pending';

  if v_pending > 0 then
    raise exception 'A pending claim with this UTR already exists for this flat.';
  end if;

  if v_purpose = 'rent' and v_month is not null then
    select count(*)::int into v_pending
    from public.payment_submissions ps
    where ps.flat_id = v_flat_id
      and ps.purpose = 'rent'
      and ps.billing_month = v_month
      and ps.status = 'pending';

    if v_pending > 0 then
      raise exception 'A pending rent claim already exists for this flat and billing month.';
    end if;
  end if;

  insert into public.payment_submissions (
    tenancy_id,
    flat_id,
    purpose,
    billing_month,
    amount,
    payment_date,
    utr,
    upi_id,
    notes,
    proof_path,
    payer_name,
    payer_phone,
    status,
    submitted_by
  ) values (
    v_tenancy_id,
    v_flat_id,
    v_purpose,
    v_month,
    p_amount,
    p_payment_date,
    v_utr,
    v_upi,
    v_notes,
    v_proof,
    v_name,
    v_phone_digits,
    'pending',
    null
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_payment_claim(
  text, text, numeric, date, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_public_payment_claim(
  text, text, numeric, date, text, text, text, text, text, text, text
) to anon, authenticated;

comment on function public.submit_public_payment_claim is
  'Public pay page: insert pending payment claim for a known flat. Never creates payments/receipts.';

-- ---------------------------------------------------------------------------
-- Storage: anon may upload proofs only under public-claims/
-- ---------------------------------------------------------------------------

drop policy if exists payment_proofs_anon_insert on storage.objects;
create policy payment_proofs_anon_insert
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'public-claims'
  );

-- Authenticated users may also upload under public-claims (optional)
drop policy if exists payment_proofs_public_claims_insert on storage.objects;
create policy payment_proofs_public_claims_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'public-claims'
  );
