-- Etapa 3A: campañas, slots e invitaciones

-- pack_size en albums
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS pack_size INTEGER NOT NULL DEFAULT 5;

-- Slots del álbum de una campaña
CREATE TABLE IF NOT EXISTS public.album_slots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id    UUID        NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  slot_number INTEGER     NOT NULL,
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(album_id, slot_number)
);
ALTER TABLE public.album_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_select"
  ON public.album_slots FOR SELECT USING (true);

CREATE POLICY "slots_insert_admin"
  ON public.album_slots FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.album_members am WHERE am.album_id = album_id AND am.user_id = auth.uid() AND am.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'superadmin')
  );

CREATE POLICY "slots_delete_admin"
  ON public.album_slots FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.album_members am WHERE am.album_id = album_slots.album_id AND am.user_id = auth.uid() AND am.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'superadmin')
  );

-- Invitaciones
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id    UUID        NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by  UUID        REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ,
  max_uses    INTEGER,
  uses_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select"
  ON public.invitations FOR SELECT USING (true);

CREATE POLICY "invitations_insert_admin"
  ON public.invitations FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.album_members am WHERE am.album_id = album_id AND am.user_id = auth.uid() AND am.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'superadmin')
  );

CREATE POLICY "invitations_delete_admin"
  ON public.invitations FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.album_members am WHERE am.album_id = invitations.album_id AND am.user_id = auth.uid() AND am.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'superadmin')
  );

-- RPC para usar una invitación de forma atómica
CREATE OR REPLACE FUNCTION public.use_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv    RECORD;
  v_uid    UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitación no válida');
  END IF;
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'La invitación expiró');
  END IF;
  IF v_inv.max_uses IS NOT NULL AND v_inv.uses_count >= v_inv.max_uses THEN
    RETURN jsonb_build_object('error', 'La invitación alcanzó el límite de usos');
  END IF;

  IF EXISTS (SELECT 1 FROM public.album_members WHERE album_id = v_inv.album_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'album_id', v_inv.album_id, 'already_member', true);
  END IF;

  INSERT INTO public.album_members (album_id, user_id, role, added_by)
  VALUES (v_inv.album_id, v_uid, 'member', v_inv.created_by);

  UPDATE public.invitations SET uses_count = uses_count + 1 WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'album_id', v_inv.album_id, 'already_member', false);
END;
$$;
