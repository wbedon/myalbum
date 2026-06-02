-- Reemplazar cover_templates (individuales) por cover_editions (pares portada+contraportada)
-- La tabla cover_templates no tiene datos, se puede dropar limpiamente.

DROP TABLE IF EXISTS public.cover_templates CASCADE;

CREATE TABLE public.cover_editions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  portada_url       TEXT        NOT NULL,
  contraportada_url TEXT        NOT NULL,
  sort_order        INT         NOT NULL DEFAULT 0,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cover_editions ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario puede ver las activas
CREATE POLICY "public_cover_editions_select" ON public.cover_editions
  FOR SELECT USING (is_active = true);

-- Superadmin puede ver todas y hacer CRUD
CREATE POLICY "superadmin_cover_editions_read_all" ON public.cover_editions
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_cover_editions_insert" ON public.cover_editions
  FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_cover_editions_update" ON public.cover_editions
  FOR UPDATE
  USING  ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin')
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_cover_editions_delete" ON public.cover_editions
  FOR DELETE
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

-- Actualizar albums: dos FKs separadas → una sola cover_edition_id
ALTER TABLE public.albums
  DROP COLUMN IF EXISTS portada_template_id,
  DROP COLUMN IF EXISTS contraportada_template_id,
  ADD COLUMN cover_edition_id UUID REFERENCES public.cover_editions(id) ON DELETE SET NULL;
