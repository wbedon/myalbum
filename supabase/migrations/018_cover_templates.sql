-- Tabla de plantillas de portada y contraportada del álbum

CREATE TABLE public.cover_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('portada', 'contraportada')),
  image_url   TEXT        NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cover_templates ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario puede ver las activas (para vista pública del álbum)
CREATE POLICY "public_cover_templates_select" ON public.cover_templates
  FOR SELECT
  USING (is_active = true);

-- Superadmin puede ver todas (activas e inactivas)
CREATE POLICY "superadmin_cover_templates_read_all" ON public.cover_templates
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_cover_templates_insert" ON public.cover_templates
  FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_cover_templates_update" ON public.cover_templates
  FOR UPDATE
  USING  ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin')
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_cover_templates_delete" ON public.cover_templates
  FOR DELETE
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

-- Las imágenes se almacenan en el bucket 'templates' bajo el prefijo covers/
-- Las políticas de storage del bucket 'templates' (migración 016) ya cubren este caso.
