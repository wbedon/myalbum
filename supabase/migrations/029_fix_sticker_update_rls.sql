-- Fix: owners_update_own_stickers no tenía WITH CHECK explícito.
-- PostgreSQL usaba el USING como WITH CHECK implícito, lo que bloqueaba
-- cambiar status de 'draft' a 'pending' porque 'pending' no cumple
-- la condición USING (status IN ('draft', 'rejected')).
-- Con WITH CHECK explícito, el usuario puede enviar su cromo a revisión.

DROP POLICY IF EXISTS owners_update_own_stickers ON stickers;

CREATE POLICY owners_update_own_stickers ON stickers
  FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('draft', 'rejected'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft', 'pending'));
