-- Allow payment modes used by the admin UI.
-- Inspect first (optional):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'payments_payment_mode_check';

alter table public.payments
  drop constraint if exists payments_payment_mode_check;

alter table public.payments
  add constraint payments_payment_mode_check
  check (
    payment_mode is null
    or payment_mode in (
      'cash',
      'upi',
      'bank_transfer',
      'cheque',
      'card',
      'neft',
      'other'
    )
  );
