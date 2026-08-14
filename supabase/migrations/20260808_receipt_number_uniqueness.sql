-- Dendukuri Residences: receipt number uniqueness + optional billing_month
-- Run in Supabase SQL editor against the existing project.
-- Does NOT bypass RLS. App continues to use the authenticated user client.

-- 1) Guarantee receipt numbers can never duplicate
CREATE UNIQUE INDEX IF NOT EXISTS receipts_receipt_number_uidx
  ON public.receipts (receipt_number);

ALTER TABLE public.receipts
  ALTER COLUMN receipt_number SET NOT NULL;

-- 2) Optional atomic sequence (app already generates + retries on 23505;
--    enabling this makes numbers sequential if you switch the app to call it)
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT
    'DR-'
    || to_char(timezone('Asia/Kolkata', now()), 'YYYYMM')
    || '-'
    || lpad(nextval('public.receipt_number_seq')::text, 5, '0');
$$;

-- 3) Optional dedicated billing_month column (today the app stores
--    billing_month in payments.notes as "billing_month:YYYY-MM")
-- ALTER TABLE public.payments
--   ADD COLUMN IF NOT EXISTS billing_month text;

-- 4) Suggested RLS (adjust only if policies are missing; inspect first)
-- Admin: full access to payments + receipts
-- Tenant: SELECT own receipts via tenancy -> tenants.profile_id = auth.uid()
-- Tenant: NO insert/update/delete on payments or receipts

/*
Example tenant SELECT policy for receipts (run only after reviewing existing policies):

CREATE POLICY receipts_tenant_select ON public.receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.tenancies tn ON tn.id = p.tenancy_id
      JOIN public.tenants t ON t.id = tn.tenant_id
      WHERE p.id = receipts.payment_id
        AND t.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'admin' AND pr.is_active
    )
  );
*/
