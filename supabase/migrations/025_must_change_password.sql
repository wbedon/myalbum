-- Flag para forzar cambio de contraseña en el primer login del organizador
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
