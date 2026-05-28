-- ── Extender profiles con bio ────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Policy para que cada usuario pueda actualizar su propio perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
      USING  (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── RPC: stats públicas de un usuario ─────────────────────────────
-- Devuelve perfil + contadores calculados en DB
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile           RECORD;
  v_stickers_approved INT;
  v_albums_count      INT;
  v_trades_completed  INT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_stickers_approved
  FROM stickers
  WHERE user_id = p_user_id AND status = 'approved';

  SELECT COUNT(*) INTO v_albums_count
  FROM album_members
  WHERE user_id = p_user_id;

  -- Intercambios completados: como solicitante aceptado + como ofertante que fue emparejado
  SELECT
    (SELECT COUNT(*) FROM trade_requests  WHERE requester_id = p_user_id AND status = 'accepted')
    +
    (SELECT COUNT(*) FROM trade_offers    WHERE offerer_id   = p_user_id AND status = 'matched')
  INTO v_trades_completed;

  RETURN jsonb_build_object(
    'user_id',           v_profile.user_id,
    'username',          v_profile.username,
    'bio',               v_profile.bio,
    'role',              v_profile.role,
    'created_at',        v_profile.created_at,
    'stickers_approved', v_stickers_approved,
    'albums_count',      v_albums_count,
    'trades_completed',  v_trades_completed
  );
END;
$$;
