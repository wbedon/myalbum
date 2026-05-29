-- Etapa 3M+: Web Push notifications
-- Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Push subscriptions: one row per user per browser
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_push_subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Trigger: send web push when a notification row is inserted
CREATE OR REPLACE FUNCTION trigger_web_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://myalbum-green.vercel.app/api/push/send',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-push-secret',   'e808d87dbc4e5bbae9721c92987fffcabc4255692a5ba9256c98a66ede2eb6bb'
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'type',    NEW.type,
      'message', NEW.message
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block the notification insert
END;
$$;

CREATE TRIGGER notifications_web_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_web_push();
