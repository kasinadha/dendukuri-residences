-- Per-tenancy monthly charges (maintenance, parking, washer, other).
-- Defaults to 0; editable from Admin → Tenants with confirmation.

alter table public.tenancies
  add column if not exists maintenance_charge numeric default 0,
  add column if not exists car_parking_charge numeric default 0,
  add column if not exists washing_machine_charge numeric default 0,
  add column if not exists other_monthly_charge numeric default 0,
  add column if not exists other_charges_notes text;

comment on column public.tenancies.maintenance_charge is
  'Monthly society/maintenance charge for this tenancy (₹).';
comment on column public.tenancies.car_parking_charge is
  'Monthly car parking charge for this tenancy (₹).';
comment on column public.tenancies.washing_machine_charge is
  'Monthly washing machine usage charge for this tenancy (₹).';
comment on column public.tenancies.other_monthly_charge is
  'Other recurring monthly charges for this tenancy (₹).';
