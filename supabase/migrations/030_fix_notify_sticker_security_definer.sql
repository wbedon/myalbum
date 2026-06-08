-- El trigger notify_sticker_status_change fallaba con RLS porque corría como
-- SECURITY INVOKER (con el JWT del organizador), pero insertaba notificaciones
-- para el participante (user_id = NEW.user_id). RLS bloqueaba el INSERT porque
-- auth.uid() del organizador != user_id del participante.
-- Solución: SECURITY DEFINER para que el trigger corra como el dueño de la función
-- (postgres) y pueda insertar notificaciones para cualquier usuario.

CREATE OR REPLACE FUNCTION notify_sticker_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
