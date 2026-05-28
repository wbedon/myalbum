-- ── Tabla sticker_reactions ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS sticker_reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID        NOT NULL REFERENCES stickers(id)  ON DELETE CASCADE,
  album_id   UUID        NOT NULL REFERENCES albums(id)    ON DELETE CASCADE,
  emoji      TEXT        NOT NULL CHECK (emoji IN ('❤️','🔥','⭐','😂')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sticker_id, emoji)
);

CREATE INDEX IF NOT EXISTS reactions_album ON sticker_reactions(album_id);

ALTER TABLE sticker_reactions ENABLE ROW LEVEL SECURITY;

-- Miembros del álbum (y superadmin) pueden leer las reacciones
CREATE POLICY "reactions_select" ON sticker_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM album_members
      WHERE album_id = sticker_reactions.album_id AND user_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
  );

-- ── RPC: toggle_reaction ──────────────────────────────────────────
-- Inserta la reacción si no existe, la elimina si ya existe (toggle).
-- Valida pertenencia al álbum y emoji permitido.
CREATE OR REPLACE FUNCTION toggle_reaction(p_sticker_id UUID, p_emoji TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_album_id UUID;
BEGIN
  -- Verificar que el emoji es válido
  IF p_emoji NOT IN ('❤️','🔥','⭐','😂') THEN
    RAISE EXCEPTION 'emoji not allowed';
  END IF;

  -- Obtener album del sticker
  SELECT album_id INTO v_album_id FROM stickers WHERE id = p_sticker_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sticker not found'; END IF;

  -- Verificar membresía
  IF NOT EXISTS (
    SELECT 1 FROM album_members
    WHERE album_id = v_album_id AND user_id = auth.uid()
  ) AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  -- Toggle
  IF EXISTS (
    SELECT 1 FROM sticker_reactions
    WHERE user_id = auth.uid() AND sticker_id = p_sticker_id AND emoji = p_emoji
  ) THEN
    DELETE FROM sticker_reactions
    WHERE user_id = auth.uid() AND sticker_id = p_sticker_id AND emoji = p_emoji;
    RETURN jsonb_build_object('action', 'removed', 'emoji', p_emoji);
  ELSE
    INSERT INTO sticker_reactions(user_id, sticker_id, album_id, emoji)
    VALUES (auth.uid(), p_sticker_id, v_album_id, p_emoji);
    RETURN jsonb_build_object('action', 'added', 'emoji', p_emoji);
  END IF;
END;
$$;
