-- ── Tablas: packs, pack_items, collection ─────────────────────────

CREATE TABLE IF NOT EXISTS packs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id   UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'sealed' CHECK (status IN ('sealed','opened')),
  opened_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pack_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    UUID        NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  sticker_id UUID        NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id   UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id UUID        NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  pack_id    UUID        REFERENCES packs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS packs_album_user   ON packs(album_id, user_id);
CREATE INDEX IF NOT EXISTS pack_items_pack    ON pack_items(pack_id);
CREATE INDEX IF NOT EXISTS collection_user    ON collection(album_id, user_id);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE packs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection ENABLE ROW LEVEL SECURITY;

-- packs: own rows + admins of the album
CREATE POLICY "packs_select" ON packs FOR SELECT USING (
  user_id = auth.uid()
  OR album_id IN (
    SELECT album_id FROM album_members WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
);

-- pack_items: visible if the pack is visible to the user
CREATE POLICY "pack_items_select" ON pack_items FOR SELECT USING (
  pack_id IN (
    SELECT id FROM packs WHERE
      user_id = auth.uid()
      OR album_id IN (
        SELECT album_id FROM album_members WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
  )
);

-- collection: own rows + admins
CREATE POLICY "collection_select" ON collection FOR SELECT USING (
  user_id = auth.uid()
  OR album_id IN (
    SELECT album_id FROM album_members WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
);

-- ── RPC: generate_packs ───────────────────────────────────────────
-- Genera 1 sobre por participante con pack_size stickers aleatorios aprobados.
-- Solo puede llamarlo un admin o superadmin del álbum.
CREATE OR REPLACE FUNCTION generate_packs(p_album_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pack_size    INT;
  v_member_uid   UUID;
  v_new_pack_id  UUID;
  v_count        INT := 0;
  v_pool_count   INT;
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

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── RPC: open_pack ────────────────────────────────────────────────
-- Abre un sobre sellado: marca como abierto, copia ítems a collection,
-- devuelve JSON con los stickers revelados.
CREATE OR REPLACE FUNCTION open_pack(p_pack_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pack     RECORD;
  v_stickers JSON;
BEGIN
  SELECT * INTO v_pack FROM packs WHERE id = p_pack_id;
  IF NOT FOUND                       THEN RAISE EXCEPTION 'pack not found';    END IF;
  IF v_pack.user_id <> auth.uid()    THEN RAISE EXCEPTION 'not your pack';     END IF;
  IF v_pack.status = 'opened'        THEN RAISE EXCEPTION 'already opened';    END IF;

  UPDATE packs SET status = 'opened', opened_at = NOW() WHERE id = p_pack_id;

  INSERT INTO collection(album_id, user_id, sticker_id, pack_id)
  SELECT v_pack.album_id, auth.uid(), sticker_id, p_pack_id
  FROM pack_items WHERE pack_id = p_pack_id;

  SELECT json_agg(json_build_object(
    'sticker_id', pi.sticker_id,
    'image_url',  s.image_url,
    'slot_id',    s.slot_id,
    'slot_number', sl.slot_number,
    'slot_label',  sl.label
  ))
  INTO v_stickers
  FROM pack_items pi
  JOIN stickers     s  ON s.id  = pi.sticker_id
  JOIN album_slots  sl ON sl.id = s.slot_id
  WHERE pi.pack_id = p_pack_id;

  RETURN json_build_object('stickers', v_stickers);
END;
$$;
