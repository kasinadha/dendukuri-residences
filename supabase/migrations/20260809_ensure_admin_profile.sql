-- Fix admin login: Auth user password alone is not enough.
-- This app also requires public.profiles with role='admin' and is_active=true.
--
-- HOW TO USE (Supabase Dashboard → SQL Editor):
-- 1) Replace 'YOUR_ADMIN_EMAIL@example.com' with the email you use on /login
-- 2) Run the script
-- 3) Sign in again at http://127.0.0.1:3020/login

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'YOUR_ADMIN_EMAIL@example.com';
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'No auth.users row for %. Create the user in Authentication → Users first (or sign up), then re-run.',
      v_email;
  END IF;

  INSERT INTO public.profiles (id, role, is_active, full_name)
  VALUES (v_user_id, 'admin', true, 'Admin')
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        is_active = true;

  RAISE NOTICE 'Admin profile ready for % (id=%)', v_email, v_user_id;
END $$;

-- Optional: confirm
-- SELECT id, email, email_confirmed_at FROM auth.users ORDER BY created_at DESC;
-- SELECT id, role, is_active, full_name FROM public.profiles;
