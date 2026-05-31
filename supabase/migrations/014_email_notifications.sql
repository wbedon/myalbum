-- Email notification trigger on notifications table
-- Fires after every INSERT, calls /api/email/send via pg_net (same pattern as push)

CREATE OR REPLACE FUNCTION trigger_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://myalbum-green.vercel.app/api/email/send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-push-secret', 'e808d87dbc4e5bbae9721c92987fffcabc4255692a5ba9256c98a66ede2eb6bb'
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'type',    NEW.type,
      'payload', NEW.payload
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- nunca bloquea el INSERT de la notificación
END;
$$;

CREATE TRIGGER notifications_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_email_notification();
