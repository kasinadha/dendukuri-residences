-- Allow deposit/advance payments (required for Mark as deposit + Record Payment deposit).
-- Inspect first (optional):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'payments_payment_type_check';

alter table public.payments
  drop constraint if exists payments_payment_type_check;

alter table public.payments
  add constraint payments_payment_type_check
  check (
    payment_type is null
    or lower(payment_type) in (
      'rent',
      'advance',
      'maintenance'
    )
  );

comment on column public.payments.payment_type is
  'rent = monthly dues; advance = security deposit; maintenance = monthly maintenance charge.';
