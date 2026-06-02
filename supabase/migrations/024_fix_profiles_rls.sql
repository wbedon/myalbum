-- Fix: la policy superadmin_profiles_select_all tenía referencia circular
-- (consultaba profiles para verificar el rol al leer profiles → bucle).
-- La reemplazamos por una policy simple que permite a cada usuario leer su propio perfil.

DROP POLICY IF EXISTS "superadmin_profiles_select_all" ON public.profiles;

-- Cualquier usuario autenticado puede leer su propio perfil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_read_own'
  ) THEN
    CREATE POLICY "profiles_read_own" ON public.profiles
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;
