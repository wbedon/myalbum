-- Ampliar constraint para incluir sticker_commented
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'sticker_approved', 'sticker_rejected',
    'trade_requested',  'trade_accepted',
    'pack_available',   'sticker_commented'
  ));

-- Trigger: notificar al dueño del sticker cuando alguien comenta
CREATE OR REPLACE FUNCTION notify_sticker_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sticker_owner_id UUID;
BEGIN
  -- Obtener el dueño del sticker
  SELECT user_id INTO v_sticker_owner_id FROM stickers WHERE id = NEW.sticker_id;

  -- No notificar si el comentarista es el dueño
  IF v_sticker_owner_id IS NULL OR v_sticker_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications(user_id, album_id, type, payload)
  VALUES (
    v_sticker_owner_id,
    NEW.album_id,
    'sticker_commented',
    jsonb_build_object('commenter_id', NEW.user_id, 'content_preview', left(NEW.content, 60))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sticker_comments_notify ON sticker_comments;
CREATE TRIGGER sticker_comments_notify
  AFTER INSERT ON sticker_comments
  FOR EACH ROW EXECUTE FUNCTION notify_sticker_comment();
