-- ── Columna is_public en albums ──────────────────────────────────────
ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Admins y superadmin pueden actualizar el álbum (incluyendo is_public)
DO $$ BEGIN
  CREATE POLICY "admins_update_album" ON albums FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM album_members
        WHERE album_id = albums.id AND user_id = auth.uid() AND role = 'admin'
      )
      OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RPC: get_public_album ─────────────────────────────────────────────
-- Devuelve todos los datos públicos de un álbum sin requerir autenticación.
-- Falla si el álbum no existe o no es público.
CREATE OR REPLACE FUNCTION get_public_album(p_album_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_album RECORD;
BEGIN
  SELECT id, name, description, pack_size
  INTO v_album
  FROM albums
  WHERE id = p_album_id AND is_public = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'album not found or not public';
  END IF;

  RETURN jsonb_build_object(
    'album', jsonb_build_object(
      'id',          v_album.id,
      'name',        v_album.name,
      'description', v_album.description
    ),
    'slots', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', id, 'slot_number', slot_number, 'label', label)
        ORDER BY slot_number
      ), '[]'::jsonb)
      FROM album_slots WHERE album_id = p_album_id
    ),
    'stickers', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',        s.id,
          'image_url', s.image_url,
          'slot_id',   s.slot_id,
          'user_id',   s.user_id,
          'username',  COALESCE(p.username, left(s.user_id::text, 8))
        )
      ), '[]'::jsonb)
      FROM stickers s
      LEFT JOIN profiles p ON p.user_id = s.user_id
      WHERE s.album_id = p_album_id AND s.status = 'approved'
    ),
    'reactions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('sticker_id', sticker_id, 'emoji', emoji, 'count', cnt)
      ), '[]'::jsonb)
      FROM (
        SELECT sticker_id, emoji, COUNT(*) AS cnt
        FROM sticker_reactions
        WHERE album_id = p_album_id
        GROUP BY sticker_id, emoji
      ) r
    ),
    'ranking', (
      SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'user_id',     am.user_id,
          'username',    COALESCE(p.username, left(am.user_id::text, 8)),
          'slots_count', (
            SELECT COUNT(DISTINCT st.slot_id)
            FROM collection c
            JOIN stickers st ON st.id = c.sticker_id AND st.status = 'approved'
            WHERE c.album_id = p_album_id AND c.user_id = am.user_id
          )
        ) AS row_data,
        (
          SELECT COUNT(DISTINCT st.slot_id)
          FROM collection c
          JOIN stickers st ON st.id = c.sticker_id AND st.status = 'approved'
          WHERE c.album_id = p_album_id AND c.user_id = am.user_id
        ) AS sort_key
        FROM album_members am
        LEFT JOIN profiles p ON p.user_id = am.user_id
        WHERE am.album_id = p_album_id
        ORDER BY sort_key DESC, COALESCE(p.username, am.user_id::text)
      ) sub
    )
  );
END;
$$;
