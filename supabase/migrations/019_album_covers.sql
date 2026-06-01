-- Asociar portada y contraportada a cada álbum

ALTER TABLE public.albums
  ADD COLUMN portada_template_id       UUID REFERENCES public.cover_templates(id) ON DELETE SET NULL,
  ADD COLUMN contraportada_template_id UUID REFERENCES public.cover_templates(id) ON DELETE SET NULL;
