-- Actualizar RPC get_public_album para usar cover_editions en lugar de cover_templates

CREATE OR REPLACE FUNCTION get_public_album(p_album_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_album RECORD;
BEGIN
  SELECT a.id, a.name, a.description, a.pack_size,
         ce.portada_url,
         ce.contraportada_url
  INTO v_album
  FROM albums a
  LEFT JOIN cover_editions ce ON ce.id = a.cover_edition_id AND ce.is_active = true
  WHERE a.id = p_album_id AND a.is_public = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'album not found or not public';
  END IF;

  RETURN jsonb_build_object(
    'album', jsonb_build_object(
      'id',                      v_album.id,
      'name',                    v_album.name,
      'description',             v_album.description,
      'portada_image_url',       v_album.portada_url,
      'contraportada_image_url', v_album.contraportada_url
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
