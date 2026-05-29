-- Etapa 3L: RPC get_album_stats para el dashboard de estadísticas del admin
CREATE OR REPLACE FUNCTION get_album_stats(p_album_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only admins or superadmin can view stats
  IF NOT EXISTS (
    SELECT 1 FROM album_members
    WHERE album_id = p_album_id AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_superadmin = true
    ) THEN
      RAISE EXCEPTION 'access denied';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'stickers_by_status', (
      SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
      FROM (
        SELECT status, COUNT(*) AS cnt
        FROM stickers
        WHERE album_id = p_album_id
        GROUP BY status
      ) s
    ),
    'total_members', (
      SELECT COUNT(*) FROM album_members WHERE album_id = p_album_id
    ),
    'total_slots', (
      SELECT COUNT(*) FROM album_slots WHERE album_id = p_album_id
    ),
    'slots_covered', (
      SELECT COUNT(DISTINCT slot_id)
      FROM stickers
      WHERE album_id = p_album_id AND status = 'approved'
    ),
    'recent_activity', (
      SELECT COALESCE(jsonb_agg(a ORDER BY a.updated_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          s.id,
          s.status,
          s.updated_at,
          p.username,
          sl.slot_number,
          sl.label AS slot_label
        FROM stickers s
        JOIN profiles p  ON p.user_id = s.user_id
        JOIN album_slots sl ON sl.id = s.slot_id
        WHERE s.album_id = p_album_id
        ORDER BY s.updated_at DESC
        LIMIT 10
      ) a
    ),
    'top_reactors', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.reaction_count DESC), '[]'::jsonb)
      FROM (
        SELECT
          p.username,
          COUNT(*) AS reaction_count
        FROM sticker_reactions sr
        JOIN profiles p ON p.user_id = sr.user_id
        WHERE sr.album_id = p_album_id
        GROUP BY p.username
        ORDER BY reaction_count DESC
        LIMIT 5
      ) r
    ),
    'reactions_by_emoji', (
      SELECT COALESCE(jsonb_object_agg(emoji, cnt), '{}'::jsonb)
      FROM (
        SELECT emoji, COUNT(*) AS cnt
        FROM sticker_reactions
        WHERE album_id = p_album_id
        GROUP BY emoji
      ) e
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_album_stats(UUID) TO authenticated;
