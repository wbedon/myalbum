-- ── Tabla achievements ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type      TEXT        NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver los logros (visibles en perfiles públicos)
CREATE POLICY "achievements_select" ON achievements FOR SELECT USING (true);

-- Solo el sistema (SECURITY DEFINER) puede insertar — no el cliente directamente
-- (La inserción se hace exclusivamente desde los triggers a continuación)

-- ── Trigger: primer cromo enviado ────────────────────────────────
CREATE OR REPLACE FUNCTION award_on_sticker_submit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO achievements(user_id, type)
    VALUES (NEW.user_id, 'first_sticker_submitted')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_sticker_submit ON stickers;
CREATE TRIGGER award_sticker_submit
  AFTER INSERT ON stickers
  FOR EACH ROW EXECUTE FUNCTION award_on_sticker_submit();

-- ── Trigger: primer / 5 cromos aprobados ─────────────────────────
CREATE OR REPLACE FUNCTION award_on_sticker_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO achievements(user_id, type)
    VALUES (NEW.user_id, 'first_sticker_approved')
    ON CONFLICT DO NOTHING;

    SELECT COUNT(*) INTO v_count
    FROM stickers WHERE user_id = NEW.user_id AND status = 'approved';

    IF v_count >= 5 THEN
      INSERT INTO achievements(user_id, type)
      VALUES (NEW.user_id, 'sticker_approved_5')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_sticker_approved ON stickers;
CREATE TRIGGER award_sticker_approved
  AFTER UPDATE ON stickers
  FOR EACH ROW EXECUTE FUNCTION award_on_sticker_approved();

-- ── Trigger: primer sobre abierto ────────────────────────────────
CREATE OR REPLACE FUNCTION award_on_pack_opened()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'opened' AND OLD.status = 'sealed' THEN
    INSERT INTO achievements(user_id, type)
    VALUES (NEW.user_id, 'first_pack_opened')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_pack_opened ON packs;
CREATE TRIGGER award_pack_opened
  AFTER UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION award_on_pack_opened();

-- ── Trigger: primer / 5 intercambios completados ─────────────────
CREATE OR REPLACE FUNCTION award_on_trade_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO achievements(user_id, type)
    VALUES (NEW.requester_id, 'first_trade')
    ON CONFLICT DO NOTHING;

    SELECT COUNT(*) INTO v_count
    FROM trade_requests WHERE requester_id = NEW.requester_id AND status = 'accepted';

    IF v_count >= 5 THEN
      INSERT INTO achievements(user_id, type)
      VALUES (NEW.requester_id, 'trader_5')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_trade_accepted ON trade_requests;
CREATE TRIGGER award_trade_accepted
  AFTER UPDATE ON trade_requests
  FOR EACH ROW EXECUTE FUNCTION award_on_trade_accepted();

-- ── Trigger: primera carta / 10 cartas / álbum completo ──────────
CREATE OR REPLACE FUNCTION award_on_collection_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count        INT;
  v_total_slots  INT;
  v_unique_slots INT;
BEGIN
  -- Contar total de items en la colección (este álbum)
  SELECT COUNT(*) INTO v_count
  FROM collection
  WHERE user_id = NEW.user_id AND album_id = NEW.album_id;

  IF v_count >= 1 THEN
    INSERT INTO achievements(user_id, type)
    VALUES (NEW.user_id, 'first_card_collected')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_count >= 10 THEN
    INSERT INTO achievements(user_id, type)
    VALUES (NEW.user_id, 'collector_10')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Verificar álbum completo: todos los slots cubiertos
  SELECT COUNT(*) INTO v_total_slots
  FROM album_slots WHERE album_id = NEW.album_id;

  IF v_total_slots > 0 THEN
    SELECT COUNT(DISTINCT s.slot_id) INTO v_unique_slots
    FROM collection c
    JOIN stickers s ON s.id = c.sticker_id
    WHERE c.user_id = NEW.user_id AND c.album_id = NEW.album_id;

    IF v_unique_slots >= v_total_slots THEN
      INSERT INTO achievements(user_id, type)
      VALUES (NEW.user_id, 'album_complete')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_collection ON collection;
CREATE TRIGGER award_collection
  AFTER INSERT ON collection
  FOR EACH ROW EXECUTE FUNCTION award_on_collection_insert();

-- ── Actualizar get_user_stats para incluir logros ────────────────
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile           RECORD;
  v_stickers_approved INT;
  v_albums_count      INT;
  v_trades_completed  INT;
  v_achievements      JSONB;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_stickers_approved
  FROM stickers WHERE user_id = p_user_id AND status = 'approved';

  SELECT COUNT(*) INTO v_albums_count
  FROM album_members WHERE user_id = p_user_id;

  SELECT
    (SELECT COUNT(*) FROM trade_requests WHERE requester_id = p_user_id AND status = 'accepted')
    +
    (SELECT COUNT(*) FROM trade_offers   WHERE offerer_id   = p_user_id AND status = 'matched')
  INTO v_trades_completed;

  SELECT jsonb_agg(jsonb_build_object('type', type, 'earned_at', earned_at))
  INTO v_achievements
  FROM achievements WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id',           v_profile.user_id,
    'username',          v_profile.username,
    'bio',               v_profile.bio,
    'role',              v_profile.role,
    'created_at',        v_profile.created_at,
    'stickers_approved', v_stickers_approved,
    'albums_count',      v_albums_count,
    'trades_completed',  v_trades_completed,
    'achievements',      COALESCE(v_achievements, '[]'::jsonb)
  );
END;
$$;
