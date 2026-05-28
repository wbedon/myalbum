-- ── Storage bucket para stickers ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stickers', 'stickers', true, 10485760, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── Tabla stickers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stickers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id         UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  slot_id          UUID        NOT NULL REFERENCES album_slots(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url        TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','pending','approved','rejected')),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slot_id, user_id)
);

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION update_stickers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS stickers_updated_at ON stickers;
CREATE TRIGGER stickers_updated_at
  BEFORE UPDATE ON stickers
  FOR EACH ROW EXECUTE FUNCTION update_stickers_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro del álbum puede ver stickers del álbum
CREATE POLICY "album_members_view_stickers" ON stickers
  FOR SELECT USING (
    album_id IN (
      SELECT album_id FROM album_members WHERE user_id = auth.uid()
    )
  );

-- Usuarios insertan solo sus propios stickers
CREATE POLICY "users_insert_own_stickers" ON stickers
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Dueño actualiza su sticker cuando está en borrador o rechazado
CREATE POLICY "owners_update_own_stickers" ON stickers
  FOR UPDATE USING (
    user_id = auth.uid() AND status IN ('draft','rejected')
  );

-- Admins del álbum pueden actualizar cualquier sticker (aprobar/rechazar)
CREATE POLICY "admins_update_stickers" ON stickers
  FOR UPDATE USING (
    album_id IN (
      SELECT album_id FROM album_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Dueño puede eliminar sus stickers en borrador
CREATE POLICY "owners_delete_draft_stickers" ON stickers
  FOR DELETE USING (user_id = auth.uid() AND status = 'draft');

-- ── Storage policies (bucket stickers) ───────────────────────────
CREATE POLICY "stickers_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'stickers');

CREATE POLICY "stickers_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'stickers' AND auth.uid() IS NOT NULL);

CREATE POLICY "stickers_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'stickers' AND auth.uid() IS NOT NULL);

CREATE POLICY "stickers_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'stickers' AND auth.uid() IS NOT NULL);
