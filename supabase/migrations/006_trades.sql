-- ── Tablas: trade_offers, trade_requests ─────────────────────────

CREATE TABLE IF NOT EXISTS trade_offers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id      UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  offerer_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID        NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','matched','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      UUID        NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  requester_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID        NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','accepted','declined')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(offer_id, requester_id)
);

CREATE INDEX IF NOT EXISTS trade_offers_album ON trade_offers(album_id, status);
CREATE INDEX IF NOT EXISTS trade_requests_offer ON trade_requests(offer_id);
CREATE INDEX IF NOT EXISTS trade_requests_requester ON trade_requests(requester_id);

-- ── Ampliar RLS de collection para intercambios ───────────────────
-- Los miembros del álbum necesitan ver la colección de otros para
-- poder ver qué ofrecen en el mercado de intercambios.
DROP POLICY IF EXISTS "collection_select" ON collection;
CREATE POLICY "collection_select" ON collection FOR SELECT USING (
  album_id IN (
    SELECT album_id FROM album_members WHERE user_id = auth.uid()
  )
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
);

-- ── RLS: trade_offers ─────────────────────────────────────────────
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_offers_select" ON trade_offers FOR SELECT USING (
  album_id IN (
    SELECT album_id FROM album_members WHERE user_id = auth.uid()
  )
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
);

-- ── RLS: trade_requests ───────────────────────────────────────────
ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_requests_select" ON trade_requests FOR SELECT USING (
  requester_id = auth.uid()
  OR offer_id IN (
    SELECT id FROM trade_offers WHERE offerer_id = auth.uid()
  )
  OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
);

-- ── RPC: offer_trade ──────────────────────────────────────────────
-- Pone una collection item del usuario en el mercado de intercambios.
CREATE OR REPLACE FUNCTION offer_trade(p_collection_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item    RECORD;
  v_offer_id UUID;
BEGIN
  SELECT * INTO v_item FROM collection WHERE id = p_collection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'collection item not found'; END IF;
  IF v_item.user_id <> auth.uid() THEN RAISE EXCEPTION 'not your item'; END IF;

  IF EXISTS (
    SELECT 1 FROM trade_offers
    WHERE collection_id = p_collection_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'item already offered';
  END IF;

  INSERT INTO trade_offers(album_id, offerer_id, collection_id)
  VALUES (v_item.album_id, auth.uid(), p_collection_id)
  RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$;

-- ── RPC: request_trade ────────────────────────────────────────────
-- Solicita intercambiar con una oferta del mercado, ofreciendo una
-- collection item propia a cambio.
CREATE OR REPLACE FUNCTION request_trade(p_offer_id UUID, p_collection_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_offer RECORD;
  v_item  RECORD;
  v_req_id UUID;
BEGIN
  SELECT * INTO v_offer FROM trade_offers WHERE id = p_offer_id;
  IF NOT FOUND                          THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v_offer.status <> 'open'           THEN RAISE EXCEPTION 'offer not open'; END IF;
  IF v_offer.offerer_id = auth.uid()    THEN RAISE EXCEPTION 'cannot request own offer'; END IF;

  SELECT * INTO v_item FROM collection WHERE id = p_collection_id;
  IF NOT FOUND                          THEN RAISE EXCEPTION 'collection item not found'; END IF;
  IF v_item.user_id <> auth.uid()       THEN RAISE EXCEPTION 'not your item'; END IF;
  IF v_item.album_id <> v_offer.album_id THEN RAISE EXCEPTION 'wrong album'; END IF;

  INSERT INTO trade_requests(offer_id, requester_id, collection_id)
  VALUES (p_offer_id, auth.uid(), p_collection_id)
  ON CONFLICT (offer_id, requester_id) DO UPDATE
    SET collection_id = EXCLUDED.collection_id, status = 'pending'
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END;
$$;

-- ── RPC: accept_trade ─────────────────────────────────────────────
-- El ofertante acepta una solicitud: intercambia los dueños de ambas
-- collection items y cierra la oferta.
CREATE OR REPLACE FUNCTION accept_trade(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req   RECORD;
  v_offer RECORD;
BEGIN
  SELECT * INTO v_req FROM trade_requests WHERE id = p_request_id;
  IF NOT FOUND                    THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending'    THEN RAISE EXCEPTION 'request not pending'; END IF;

  SELECT * INTO v_offer FROM trade_offers WHERE id = v_req.offer_id;
  IF v_offer.offerer_id <> auth.uid() THEN RAISE EXCEPTION 'not your offer'; END IF;
  IF v_offer.status <> 'open'         THEN RAISE EXCEPTION 'offer not open'; END IF;

  -- Swap owners of both collection items
  UPDATE collection SET user_id = v_req.requester_id WHERE id = v_offer.collection_id;
  UPDATE collection SET user_id = auth.uid()          WHERE id = v_req.collection_id;

  -- Settle statuses
  UPDATE trade_requests SET status = 'accepted'  WHERE id = p_request_id;
  UPDATE trade_requests SET status = 'declined'
    WHERE offer_id = v_req.offer_id AND id <> p_request_id AND status = 'pending';
  UPDATE trade_offers   SET status = 'matched'   WHERE id = v_req.offer_id;
END;
$$;

-- ── RPC: cancel_offer ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_offer(p_offer_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_offer RECORD;
BEGIN
  SELECT * INTO v_offer FROM trade_offers WHERE id = p_offer_id;
  IF NOT FOUND                          THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v_offer.offerer_id <> auth.uid()   THEN RAISE EXCEPTION 'not your offer'; END IF;
  IF v_offer.status <> 'open'           THEN RAISE EXCEPTION 'offer not open'; END IF;

  UPDATE trade_offers   SET status = 'cancelled' WHERE id = p_offer_id;
  UPDATE trade_requests SET status = 'declined'
    WHERE offer_id = p_offer_id AND status = 'pending';
END;
$$;

-- ── RPC: cancel_request ───────────────────────────────────────────
-- Puede ser llamado por el solicitante (retirar solicitud) o por el
-- ofertante (rechazar una solicitud específica).
CREATE OR REPLACE FUNCTION cancel_request(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req   RECORD;
  v_offer RECORD;
BEGIN
  SELECT * INTO v_req FROM trade_requests WHERE id = p_request_id;
  IF NOT FOUND                 THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request not pending'; END IF;

  SELECT * INTO v_offer FROM trade_offers WHERE id = v_req.offer_id;

  IF v_req.requester_id <> auth.uid() AND v_offer.offerer_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE trade_requests SET status = 'declined' WHERE id = p_request_id;
END;
$$;
