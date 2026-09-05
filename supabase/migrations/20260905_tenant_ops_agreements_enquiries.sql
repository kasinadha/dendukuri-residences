-- Tenant maintenance RLS, name-change requests, rental agreements,
-- waste fines, and enquiry CRM.
-- Idempotent. Run in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. maintenance_requests: tenant SELECT/INSERT + admin ALL
-- ---------------------------------------------------------------------------

alter table public.maintenance_requests enable row level security;

drop policy if exists maintenance_requests_admin_all on public.maintenance_requests;
create policy maintenance_requests_admin_all
  on public.maintenance_requests
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists maintenance_requests_tenant_select on public.maintenance_requests;
create policy maintenance_requests_tenant_select
  on public.maintenance_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.flat_id = maintenance_requests.flat_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists maintenance_requests_tenant_insert on public.maintenance_requests;
create policy maintenance_requests_tenant_insert
  on public.maintenance_requests
  for insert
  to authenticated
  with check (
    coalesce(status, 'open') = 'open'
    and payer_account_id is null
    and exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.flat_id = maintenance_requests.flat_id
        and tn.profile_id = auth.uid()
        and lower(coalesce(t.status, '')) in ('active', 'occupied', '')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Tenant name-change requests
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  field text not null default 'full_name',
  current_value text,
  requested_value text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  tenant_note text,
  admin_note text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tenant_change_requests_field_check
    check (field in ('full_name'))
);

create index if not exists tenant_change_requests_tenant_idx
  on public.tenant_change_requests (tenant_id, created_at desc);

create index if not exists tenant_change_requests_status_idx
  on public.tenant_change_requests (status, created_at desc);

alter table public.tenant_change_requests enable row level security;

drop policy if exists tenant_change_requests_admin_all on public.tenant_change_requests;
create policy tenant_change_requests_admin_all
  on public.tenant_change_requests
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists tenant_change_requests_tenant_select on public.tenant_change_requests;
create policy tenant_change_requests_tenant_select
  on public.tenant_change_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.tenants tn
      where tn.id = tenant_change_requests.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists tenant_change_requests_tenant_insert on public.tenant_change_requests;
create policy tenant_change_requests_tenant_insert
  on public.tenant_change_requests
  for insert
  to authenticated
  with check (
    status = 'pending'
    and field = 'full_name'
    and exists (
      select 1 from public.tenants tn
      where tn.id = tenant_change_requests.tenant_id
        and tn.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Agreement templates, per-tenancy agreements, reminders, waste fines
-- ---------------------------------------------------------------------------

create table if not exists public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  title text not null default 'Rental agreement',
  body text not null,
  is_current boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create unique index if not exists agreement_templates_version_uidx
  on public.agreement_templates (version);

create unique index if not exists agreement_templates_one_current_uidx
  on public.agreement_templates (is_current)
  where is_current;

alter table public.agreement_templates enable row level security;

drop policy if exists agreement_templates_admin_all on public.agreement_templates;
create policy agreement_templates_admin_all
  on public.agreement_templates
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists agreement_templates_tenant_select on public.agreement_templates;
create policy agreement_templates_tenant_select
  on public.agreement_templates
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'tenant'
        and coalesce(p.is_active, true)
    )
  );

create table if not exists public.tenancy_agreements (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies (id) on delete cascade,
  template_id uuid not null references public.agreement_templates (id),
  flat_number text,
  tenant_name text,
  monthly_rent numeric,
  maintenance_charge numeric,
  car_parking_charge numeric,
  washing_machine_charge numeric,
  other_monthly_charge numeric,
  other_charges_notes text,
  deposit_amount numeric,
  deposit_paid numeric,
  admin_status text not null default 'draft'
    check (admin_status in ('draft', 'approved')),
  tenant_status text not null default 'pending'
    check (tenant_status in ('pending', 'accepted')),
  accepted_checks jsonb,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tenancy_agreements_tenancy_idx
  on public.tenancy_agreements (tenancy_id, created_at desc);

create index if not exists tenancy_agreements_admin_status_idx
  on public.tenancy_agreements (admin_status, tenant_status);

alter table public.tenancy_agreements enable row level security;

drop policy if exists tenancy_agreements_admin_all on public.tenancy_agreements;
create policy tenancy_agreements_admin_all
  on public.tenancy_agreements
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists tenancy_agreements_tenant_select on public.tenancy_agreements;
create policy tenancy_agreements_tenant_select
  on public.tenancy_agreements
  for select
  to authenticated
  using (
    admin_status = 'approved'
    and exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = tenancy_agreements.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );

drop policy if exists tenancy_agreements_tenant_update on public.tenancy_agreements;
create policy tenancy_agreements_tenant_update
  on public.tenancy_agreements
  for update
  to authenticated
  using (
    admin_status = 'approved'
    and tenant_status = 'pending'
    and exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = tenancy_agreements.tenancy_id
        and tn.profile_id = auth.uid()
    )
  )
  with check (
    admin_status = 'approved'
    and tenant_status = 'accepted'
    and exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = tenancy_agreements.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );

create table if not exists public.agreement_reminders (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.tenancy_agreements (id) on delete cascade,
  tenancy_id uuid not null references public.tenancies (id) on delete cascade,
  reminded_at timestamptz not null default now(),
  reminded_by uuid references auth.users (id),
  channel text,
  notes text
);

create index if not exists agreement_reminders_agreement_idx
  on public.agreement_reminders (agreement_id, reminded_at desc);

alter table public.agreement_reminders enable row level security;

drop policy if exists agreement_reminders_admin_all on public.agreement_reminders;
create policy agreement_reminders_admin_all
  on public.agreement_reminders
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

create table if not exists public.tenant_fines (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies (id) on delete cascade,
  kind text not null default 'waste_dumping'
    check (kind in ('waste_dumping')),
  offense_number integer not null check (offense_number >= 1),
  amount numeric not null check (amount > 0),
  billing_month text not null,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists tenant_fines_tenancy_month_idx
  on public.tenant_fines (tenancy_id, billing_month);

alter table public.tenant_fines enable row level security;

drop policy if exists tenant_fines_admin_all on public.tenant_fines;
create policy tenant_fines_admin_all
  on public.tenant_fines
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists tenant_fines_tenant_select on public.tenant_fines;
create policy tenant_fines_tenant_select
  on public.tenant_fines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenancies t
      join public.tenants tn on tn.id = t.tenant_id
      where t.id = tenant_fines.tenancy_id
        and tn.profile_id = auth.uid()
    )
  );

insert into public.agreement_templates (version, title, body, is_current)
select
  1,
  'Rental agreement — Dendukuri''s Residences',
  $body$This rental agreement is between the Landlord (Dendukuri's Residences, Bengaluru) and the Tenant named below, for the flat listed in the commercial terms.

1. Premises and term
The Tenant occupies the stated flat for residential use only. The arrangement follows the usual Bengaluru practice of an 11-month leave-and-licence style term, renewable by mutual consent.

2. Rent, maintenance, and other charges
The Tenant agrees the monthly rent, maintenance, parking, washing-machine, and other charges shown in the commercial terms. Rent and monthly charges are due by the 5th of each calendar month unless the Landlord agrees otherwise in writing. Electricity is billed separately from meter readings and is not house rent.

3. Security deposit
The deposit / advance shown in the commercial terms is held against unpaid dues, damage beyond normal wear, and keys. It is refundable after vacating, subject to deductions for outstanding amounts and documented repairs.

4. Use of premises
The Tenant shall not sublet, run a commercial activity, or house additional occupants beyond what was disclosed, without the Landlord's written consent. Common areas, parking, and the terrace must be kept clear and clean.

5. Waste and neighbouring plots
Household waste must be disposed of only in the designated building bins / BBMP collection. Throwing waste into neighbouring plots, vacant land, drains, or the street is prohibited. Each recorded offence attracts an automatic fine added to that month's dues:
• First offence: ₹500
• Second offence: ₹750
• Third offence: ₹1,000
• Each further offence: ₹250 more than the previous fine (₹1,250, ₹1,500, and so on).
The fine is added to the Tenant's outstanding dues and must be paid with rent.

6. Care of the flat
The Tenant shall keep the flat in good condition, report repairs promptly, and allow reasonable inspection with prior notice except in emergency.

7. Notice and termination
Either party may end the occupancy with the notice period agreed at move-in (typically 30 days) unless a lock-in applies. The Tenant remains liable for dues until keys are returned and the vacate date is recorded.

8. General
This document records house rules and commercial terms used at Dendukuri's Residences, Bengaluru. It does not replace a stamped registered deed. By ticking the checkboxes and accepting, the Tenant confirms they have read the amounts and these terms.
$body$,
  true
where not exists (select 1 from public.agreement_templates);

-- ---------------------------------------------------------------------------
-- 4. Enquiries + follow-ups
-- ---------------------------------------------------------------------------

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  bhk_preference text,
  move_in_month text,
  budget_range text,
  occupants text,
  parking_need text,
  heard_from text,
  notes text,
  status text not null default 'new'
    check (status in (
      'new',
      'contacted',
      'visit_planned',
      'interested',
      'not_looking',
      'converted'
    )),
  next_follow_up_on date,
  converted_tenant_id uuid references public.tenants (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enquiries_status_idx
  on public.enquiries (status, next_follow_up_on);

create index if not exists enquiries_created_idx
  on public.enquiries (created_at desc);

alter table public.enquiries enable row level security;

drop policy if exists enquiries_admin_all on public.enquiries;
create policy enquiries_admin_all
  on public.enquiries
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

drop policy if exists enquiries_public_insert on public.enquiries;
create policy enquiries_public_insert
  on public.enquiries
  for insert
  to anon, authenticated
  with check (
    status = 'new'
    and length(trim(full_name)) >= 2
    and length(trim(phone)) >= 10
  );

create table if not exists public.enquiry_followups (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  body text not null,
  channel text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists enquiry_followups_enquiry_idx
  on public.enquiry_followups (enquiry_id, created_at desc);

alter table public.enquiry_followups enable row level security;

drop policy if exists enquiry_followups_admin_all on public.enquiry_followups;
create policy enquiry_followups_admin_all
  on public.enquiry_followups
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );
