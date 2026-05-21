-- =================================================================
-- MyAlbum — esquema inicial
-- =================================================================
-- Ejecutar en SQL Editor de Supabase una sola vez.

-- ----------------------------------------------------------------
-- Tabla de plantillas (fondos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT         NOT NULL,
  image_url    TEXT         NOT NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer las plantillas activas (catálogo público).
CREATE POLICY "Lectura pública de plantillas activas"
  ON public.templates FOR SELECT USING (is_active = true);

-- No definimos INSERT/UPDATE/DELETE para anon → solo el dueño del
-- proyecto puede administrar plantillas desde el dashboard.

-- ----------------------------------------------------------------
-- Tabla de fotos procesadas (cutouts del usuario)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_url   TEXT         NOT NULL,
  template_id     UUID         REFERENCES public.templates(id) ON DELETE SET NULL,
  name            TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de fotos"    ON public.photos FOR SELECT USING (true);
CREATE POLICY "Inserción anónima de fotos"  ON public.photos FOR INSERT WITH CHECK (true);

-- ================================================================
-- STORAGE
-- ================================================================
-- En el dashboard de Supabase → Storage, crear DOS buckets PÚBLICOS:
--   • photos     (para los cutouts PNG generados por usuarios)
--   • templates  (para tus imágenes de fondo)
--
-- Luego ejecutar estas políticas:

-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
--   ON CONFLICT (id) DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('templates', 'templates', true)
--   ON CONFLICT (id) DO NOTHING;

-- Bucket photos: cualquiera lee, cualquiera sube
-- CREATE POLICY "Lectura pública photos"
--   ON storage.objects FOR SELECT USING (bucket_id = 'photos');
-- CREATE POLICY "Subida anónima photos"
--   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');

-- Bucket templates: cualquiera lee, solo dueño sube (sin policy de INSERT)
-- CREATE POLICY "Lectura pública templates"
--   ON storage.objects FOR SELECT USING (bucket_id = 'templates');
