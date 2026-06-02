-- Agregar rol 'organizer' para administradores de campaña
-- Los organizadores solo ven las campañas que tienen asignadas

-- Eliminar constraint existente y recrear con el nuevo valor
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'superadmin', 'organizer'));

-- El superadmin puede actualizar el rol de cualquier perfil
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'superadmin_profiles_update_role'
  ) THEN
    CREATE POLICY "superadmin_profiles_update_role" ON public.profiles
      FOR UPDATE
      USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin')
      WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');
  END IF;
END $$;

-- El superadmin puede ver todos los perfiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'superadmin_profiles_select_all'
  ) THEN
    CREATE POLICY "superadmin_profiles_select_all" ON public.profiles
      FOR SELECT
      USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');
  END IF;
END $$;
