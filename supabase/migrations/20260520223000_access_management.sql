-- Access management helpers for manager-owned user administration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS assigned_store text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

UPDATE public.profiles
SET
  store_name = COALESCE(store_name, assigned_store, 'Hillcrest'),
  assigned_store = COALESCE(assigned_store, store_name, 'Hillcrest'),
  role = COALESCE(role, 'staff');

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'staff',
  ALTER COLUMN store_name SET NOT NULL,
  ALTER COLUMN store_name SET DEFAULT 'Hillcrest',
  ALTER COLUMN assigned_store SET NOT NULL,
  ALTER COLUMN assigned_store SET DEFAULT 'Hillcrest',
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_assigned_store_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_assigned_store_check
  CHECK (assigned_store IN ('Hillcrest', 'Hammersdale', 'Gillitts', 'Cato Ridge'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_store_name_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_store_name_check
  CHECK (store_name IN ('Hillcrest', 'Hammersdale', 'Gillitts', 'Cato Ridge'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('manager', 'staff'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_store text := COALESCE(new.raw_user_meta_data->>'assigned_store', new.raw_user_meta_data->>'store_name', 'Hillcrest');
  requested_role text := COALESCE(new.raw_user_meta_data->>'role', 'staff');
BEGIN
  INSERT INTO public.profiles (id, full_name, store_name, assigned_store, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    requested_store,
    requested_store,
    CASE WHEN requested_role IN ('manager', 'staff') THEN requested_role ELSE 'staff' END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    store_name = EXCLUDED.store_name,
    assigned_store = EXCLUDED.assigned_store,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_profile_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.last_sign_in_at IS DISTINCT FROM old.last_sign_in_at THEN
    UPDATE public.profiles
    SET last_login_at = new.last_sign_in_at,
        updated_at = now()
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_last_login ON auth.users;
CREATE TRIGGER on_auth_user_last_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_last_login();

CREATE OR REPLACE FUNCTION public.current_user_is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'manager'
  );
$$;

CREATE OR REPLACE FUNCTION public.list_access_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  store_name text,
  assigned_store text,
  last_login_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.role,
    p.store_name,
    COALESCE(p.assigned_store, p.store_name) AS assigned_store,
    COALESCE(p.last_login_at, u.last_sign_in_at) AS last_login_at,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE public.current_user_is_manager()
  ORDER BY p.full_name NULLS LAST, u.email;
$$;

CREATE OR REPLACE FUNCTION public.revoke_access_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.current_user_is_manager() THEN
    RAISE EXCEPTION 'Only managers can revoke access.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot revoke your own access.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_access_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_access_user(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
