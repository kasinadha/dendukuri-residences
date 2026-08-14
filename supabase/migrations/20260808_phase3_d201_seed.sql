-- Dendukuri Residences — Phase 3 seed: flat D201
-- Run in Supabase SQL editor (service role / dashboard) if the admin UI
-- cannot insert due to network or missing RLS write policies.
-- Idempotent: safe to re-run.

-- No dedicated `source` column on tenancies; stored on flats.notes as source:Poster

DO $$
DECLARE
  v_flat_id uuid;
  v_tenant_id uuid;
  v_tenancy_id uuid;
BEGIN
  SELECT id INTO v_flat_id
  FROM public.flats
  WHERE flat_number = 'D201'
  LIMIT 1;

  IF v_flat_id IS NULL THEN
    INSERT INTO public.flats (flat_number, status, notes)
    VALUES ('D201', 'occupied', 'source:Poster')
    RETURNING id INTO v_flat_id;
  ELSE
    UPDATE public.flats
    SET status = 'occupied',
        notes = 'source:Poster'
    WHERE id = v_flat_id;
  END IF;

  SELECT t.id INTO v_tenancy_id
  FROM public.tenancies t
  WHERE t.flat_id = v_flat_id
    AND lower(coalesce(t.status, 'active')) IN ('active', 'occupied', '')
  ORDER BY t.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_tenancy_id IS NULL THEN
    INSERT INTO public.tenants (full_name, notes)
    VALUES ('D201 Tenant', 'source:Poster')
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenancies (
      tenant_id,
      flat_id,
      start_date,
      monthly_rent,
      security_deposit,
      status
    )
    VALUES (
      v_tenant_id,
      v_flat_id,
      (timezone('Asia/Kolkata', now()))::date,
      10000,
      50000,
      'active'
    )
    RETURNING id INTO v_tenancy_id;
  ELSE
    UPDATE public.tenancies
    SET monthly_rent = 10000,
        security_deposit = 50000,
        status = 'active'
    WHERE id = v_tenancy_id;
  END IF;
END $$;
