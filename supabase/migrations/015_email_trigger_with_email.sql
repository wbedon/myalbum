-- Reemplaza trigger_email_notification para resolver el email en la DB
-- y pasarlo directamente al endpoint (evita usar auth.admin SDK en runtime)

CREATE OR REPLACE FUNCTION trigger_email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

  IF v_email IS NOT NULL THEN
    PERFORM net.http_post(
      url     := 'https://myalbum-green.vercel.app/api/email/send',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-push-secret', 'e808d87dbc4e5bbae9721c92987fffcabc4255692a5ba9256c98a66ede2eb6bb'
      ),
      body    := jsonb_build_object(
        'email',   v_email,
        'type',    NEW.type,
        'payload', NEW.payload
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
