-- Registro de todos los emails enviados o bloqueados por la app.
-- Sirve como control de cuota diaria y protección anti-spam.

CREATE TABLE IF NOT EXISTS public.email_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email     text        NOT NULL,
  type         text        NOT NULL,
  sent_at      timestamptz DEFAULT now(),
  sent_date    date        NOT NULL,          -- fecha UTC, para agrupar por día
  blocked      boolean     DEFAULT false,
  block_reason text                           -- 'global_quota' | 'recipient_quota' | 'cooldown' | 'smtp_error'
);

-- Índices para las 3 consultas de control (quota global, quota por destinatario, cooldown)
CREATE INDEX IF NOT EXISTS email_log_date_idx      ON public.email_log (sent_date, blocked);
CREATE INDEX IF NOT EXISTS email_log_recipient_idx ON public.email_log (to_email, sent_date, blocked);
CREATE INDEX IF NOT EXISTS email_log_cooldown_idx  ON public.email_log (to_email, type, sent_at, blocked);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Solo el service_role puede leer/escribir (acceso exclusivo desde API routes)
CREATE POLICY "service_role_all" ON public.email_log
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
