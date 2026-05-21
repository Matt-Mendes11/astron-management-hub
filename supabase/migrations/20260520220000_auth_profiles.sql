-- Supabase Auth profile data for role and store based access.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'staff',
  store_name text NOT NULL DEFAULT 'Hillcrest',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role IN ('manager', 'staff')),
  CONSTRAINT profiles_store_name_check CHECK (store_name IN ('Hillcrest', 'Hammersdale', 'Gillitts', 'Cato Ridge'))
);

CREATE INDEX IF NOT EXISTS profiles_store_role_idx
  ON public.profiles (store_name, role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own_name" ON public.profiles;

NOTIFY pgrst, 'reload schema';
