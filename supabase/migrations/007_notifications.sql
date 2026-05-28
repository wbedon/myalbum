-- ── Tabla notifications ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id   UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN (
    'sticker_approved', 'sticker_rejected',
    'trade_requested',  'trade_accepted',
    'pack_available'
  )),
  payload    JSONB       NOT NULL DEFAULT '{}',
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications(user_id, album_id) WHERE NOT read;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Solo permite marcar como leídas las propias
CREATE POLICY "notifications_mark_read" ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND read = true);

-- ── Trigger: sticker aprobado / rechazado ─────────────────────────
-- Dispara cuando un admin actualiza el status a 'approved' o 'rejected'
-- desde el cliente (updatedirecto, no via RPC).

CREATE OR REPLACE FUNCTION notify_sticker_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_slot_number INT;
  v_slot_label  TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;

  SELECT slot_number, label
  INTO v_slot_number, v_slot_label
  FROM album_slots WHERE id = NEW.slot_id;

  INSERT INTO notifications(user_id, album_id, type, payload)
  VALUES (
    NEW.user_id,
    NEW.album_id,
    'sticker_' || NEW.status,
    jsonb_build_object(
      'slot_number',      v_slot_number,
      'slot_label',       v_slot_label,
      'rejection_reason', NEW.rejection_reason
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stickers_notify_status ON stickers;
CREATE TRIGGER stickers_notify_status
  AFTER UPDATE ON stickers
  FOR EACH ROW EXECUTE FUNCTION notify_sticker_status_change();

-- ── RPC: request_trade (reemplaza 006 — agrega notificación) ──────
CREATE OR REPLACE FUNCTION request_trade(p_offer_id UUID, p_collection_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_offer            RECORD;
  v_item             RECORD;
  v_req_id           UUID;
  v_req_slot_number  INT;
  v_req_slot_label   TEXT;
  v_off_slot_number  INT;
  v_off_slot_label   TEXT;
  v_req_username     TEXT;
BEGIN
  SELECT * INTO v_offer FROM trade_offers WHERE id = p_offer_id;
  IF NOT FOUND                           THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v_offer.status <> 'open'            THEN RAISE EXCEPTION 'offer not open'; END IF;
  IF v_offer.offerer_id = auth.uid()     THEN RAISE EXCEPTION 'cannot request own offer'; END IF;

  SELECT * INTO v_item FROM collection WHERE id = p_collection_id;
  IF NOT FOUND                           THEN RAISE EXCEPTION 'collection item not found'; END IF;
  IF v_item.user_id <> auth.uid()        THEN RAISE EXCEPTION 'not your item'; END IF;
  IF v_item.album_id <> v_offer.album_id THEN RAISE EXCEPTION 'wrong album'; END IF;

  INSERT INTO trade_requests(offer_id, requester_id, collection_id)
  VALUES (p_offer_id, auth.uid(), p_collection_id)
  ON CONFLICT (offer_id, requester_id) DO UPDATE
    SET collection_id = EXCLUDED.collection_id, status = 'pending'
  RETURNING id INTO v_req_id;

  -- Contexto de slots para la notificación
  SELECT sl.slot_number, sl.label
  INTO v_req_slot_number, v_req_slot_label
  FROM stickers s JOIN album_slots sl ON sl.id = s.slot_id
  WHERE s.id = (SELECT sticker_id FROM collection WHERE id = p_collection_id);

  SELECT sl.slot_number, sl.label
  INTO v_off_slot_number, v_off_slot_label
  FROM stickers s JOIN album_slots sl ON sl.id = s.slot_id
  WHERE s.id = (SELECT sticker_id FROM collection WHERE id = v_offer.collection_id);

  SELECT username INTO v_req_username FROM profiles WHERE user_id = auth.uid();

  -- Notificar al ofertante
  INSERT INTO notifications(user_id, album_id, type, payload)
  VALUES (
    v_offer.offerer_id,
    v_offer.album_id,
    'trade_requested',
    jsonb_build_object(
      'requester_username', v_req_username,
      'req_slot_number',    v_req_slot_number,
      'req_slot_label',     v_req_slot_label,
      'offer_slot_number',  v_off_slot_number,
      'offer_slot_label',   v_off_slot_label
    )
  );

  RETURN v_req_id;
END;
$$;

-- ── RPC: accept_trade (reemplaza 006 — agrega notificación) ───────
CREATE OR REPLACE FUNCTION accept_trade(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req              RECORD;
  v_offer            RECORD;
  v_got_slot_number  INT;
  v_got_slot_label   TEXT;
  v_offerer_username TEXT;
BEGIN
  SELECT * INTO v_req FROM trade_requests WHERE id = p_request_id;
  IF NOT FOUND                     THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending'     THEN RAISE EXCEPTION 'request not pending'; END IF;

  SELECT * INTO v_offer FROM trade_offers WHERE id = v_req.offer_id;
  IF v_offer.offerer_id <> auth.uid() THEN RAISE EXCEPTION 'not your offer'; END IF;
  IF v_offer.status <> 'open'         THEN RAISE EXCEPTION 'offer not open'; END IF;

  UPDATE collection SET user_id = v_req.requester_id WHERE id = v_offer.collection_id;
  UPDATE collection SET user_id = auth.uid()          WHERE id = v_req.collection_id;

  UPDATE trade_requests SET status = 'accepted'  WHERE id = p_request_id;
  UPDATE trade_requests SET status = 'declined'
    WHERE offer_id = v_req.offer_id AND id <> p_request_id AND status = 'pending';
  UPDATE trade_offers   SET status = 'matched'   WHERE id = v_req.offer_id;

  -- Contexto para la notificación (sticker_id no cambia tras el swap)
  SELECT sl.slot_number, sl.label
  INTO v_got_slot_number, v_got_slot_label
  FROM stickers s JOIN album_slots sl ON sl.id = s.slot_id
  WHERE s.id = (SELECT sticker_id FROM collection WHERE id = v_offer.collection_id);

  SELECT username INTO v_offerer_username FROM profiles WHERE user_id = auth.uid();

  -- Notificar al solicitante
  INSERT INTO notifications(user_id, album_id, type, payload)
  VALUES (
    v_req.requester_id,
    v_offer.album_id,
    'trade_accepted',
    jsonb_build_object(
      'offerer_username', v_offerer_username,
      'got_slot_number',  v_got_slot_number,
      'got_slot_label',   v_got_slot_label
    )
  );
END;
$$;

-- ── RPC: generate_packs (reemplaza 005 — agrega notificaciones) ───
CREATE OR REPLACE FUNCTION generate_packs(p_album_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pack_size   INT;
  v_member_uid  UUID;
  v_new_pack_id UUID;
  v_count       INT := 0;
  v_pool_count  INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM album_members
    WHERE album_id = p_album_id AND user_id = auth.uid() AND role = 'admin'
  ) AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT pack_size INTO v_pack_size FROM albums WHERE id = p_album_id;

  SELECT COUNT(*) INTO v_pool_count
  FROM stickers WHERE album_id = p_album_id AND status = 'approved';

  IF v_pool_count = 0 THEN
    RAISE EXCEPTION 'no approved stickers in pool';
  END IF;

  FOR v_member_uid IN
    SELECT user_id FROM album_members WHERE album_id = p_album_id
  LOOP
    INSERT INTO packs(album_id, user_id) VALUES (p_album_id, v_member_uid)
    RETURNING id INTO v_new_pack_id;

    INSERT INTO pack_items(pack_id, sticker_id)
    SELECT v_new_pack_id, id
    FROM stickers
    WHERE album_id = p_album_id AND status = 'approved'
    ORDER BY random()
    LIMIT v_pack_size;

    -- Notificar al participante
    INSERT INTO notifications(user_id, album_id, type, payload)
    VALUES (
      v_member_uid,
      p_album_id,
      'pack_available',
      jsonb_build_object('pack_size', v_pack_size, 'pack_id', v_new_pack_id)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
